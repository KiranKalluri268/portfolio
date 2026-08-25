export class ThreeDQualityManager {
  constructor({
    tiers = ['low', 'medium', 'high'],
    initialTier = 'medium',
    warmupMs = 5000,
    healthyFrameMs = 22,
    heavyFrameMs = 25,
    panicFrameMs = 50,
    maxFrameGapMs = 250,
    benchmarkDeadlineMs = 15000,
    heavyFrameLimit = 5,
    heavyFrameWindowMs = 1500,
    cooldownMs = 7000,
    ignoredFramesAfterChange = 5,
    upgradeStableMs = 3000,
    mediumHeavyFrameLimit = 20,
    lowToMediumProbeMs = 8000,
    mediumProbeEvaluationMs = 6000,
    failedProbeCooldownMs = 20000,
    allowHighAutoUpgrade = false,
    onQualityDowngrade = () => {},
    onQualityUpgrade = () => {},
    onWarmupComplete = () => {},
    onMediumProbeComplete = () => {},
  } = {}) {
    this.tiers = tiers;
    this.currentTier = initialTier;

    // Time budget thresholds. 16.67ms is 60fps, 22ms is ~45fps, 25ms is 40fps,
    // 50ms is 20fps. The heavy line sits at 40fps rather than the 50fps it used
    // to, because this scene is a scroll-driven cinematic and the fall is meant
    // to be expensive - a steady 45fps there is a good result, and scoring it as
    // failure took a working tier away from the fastest phone it was tried on.
    this.healthyFrameMs = healthyFrameMs;
    this.heavyFrameMs = heavyFrameMs;
    this.panicFrameMs = panicFrameMs;
    this.maxFrameGapMs = maxFrameGapMs;

    // Heavy-frame timestamps form a bounded rolling window. Old spikes expire
    // automatically instead of influencing decisions indefinitely.
    this.heavyFrameLimit = heavyFrameLimit;
    this.heavyFrameWindowMs = heavyFrameWindowMs;
    this.heavyFrameTimestamps = [];

    // Progressive enhancement starts from a safe baseline and only upgrades
    // after sustained headroom during the initial benchmark window.
    this.warmupMs = warmupMs;
    this.warmupElapsedMs = 0;
    this.warmupComplete = false;
    this.warmupHeavyFrames = 0;
    this.warmupPanicFrames = 0;
    // Every warmup frame time, so the verdict can be a percentile instead of a
    // count of outliers. Discarded once warmup is done.
    this.warmupFrameTimes = [];

    // Safety net for the initial benchmark. Frames longer than maxFrameGapMs are
    // discarded as invalid samples, so a device slow enough that *every* frame
    // exceeds that gap never accumulates warmup time and never completes — which
    // strands the caller's loading gate forever. This deadline is real wall clock
    // so it trips in bounded time no matter how few frames the device manages;
    // time spent hidden is subtracted so a backgrounded tab does not burn it.
    this.benchmarkDeadlineMs = benchmarkDeadlineMs;
    this.benchmarkStartedAtMs = null;
    this.benchmarkHiddenMs = 0;
    this.hiddenAtMs = null;

    // Anti-oscillation: after any tier change, ignore ordinary upgrade/downgrade
    // signals until the cooldown expires. Panic frames can still downgrade.
    this.cooldownMs = cooldownMs;
    this.cooldownRemainingMs = 0;
    this.ignoredFramesAfterChange = ignoredFramesAfterChange;
    this.ignoredFramesRemaining = 0;

    // Runtime upgrades are intentionally stricter than downgrades.
    this.upgradeStableMs = upgradeStableMs;
    this.upgradeStableElapsedMs = 0;

    // Low cannot reveal spare GPU capacity when RAF is VSync-capped. After a
    // stable period, temporarily probe Medium and judge performance there.
    this.mediumHeavyFrameLimit = mediumHeavyFrameLimit;
    this.lowToMediumProbeMs = lowToMediumProbeMs;
    this.mediumProbeEvaluationMs = mediumProbeEvaluationMs;
    this.failedProbeCooldownMs = failedProbeCooldownMs;
    this.allowHighAutoUpgrade = allowHighAutoUpgrade;
    this.mediumProbeActive = false;
    this.mediumProbeElapsedMs = 0;
    this.mediumProbeHeavyFrames = 0;
    // Set once a probe has failed, and never cleared. One refusal settles the
    // question for the session.
    this.mediumProbeRejected = false;

    // Whether the frame currently being judged came from a part of the journey
    // expensive enough to be worth judging by. Set per frame from update();
    // true until told otherwise, so a caller that passes nothing is unaffected.
    this.frameIsRepresentative = true;

    // The highest tier the manager may still reach for on its own. Set by the
    // first downgrade away from a tier and never raised again, because nothing
    // that happens later is evidence the device got faster. A hand-picked tier
    // clears it - an explicit choice outranks the manager's memory.
    this.tierCeiling = null;

    // A tier chosen by hand stops the manager climbing, but not dropping. The
    // safety net is protection and stays on; probing upward is ambition, and
    // once someone has picked a tier the manager should stop having opinions
    // about going higher. Without this the visitor watches it fight them:
    // pick low, climb to medium, stumble, drop, wait, climb again.
    this.userPinned = false;

    // A locked tier refuses every automatic change, including the safety
    // downgrade a pin still allows. This exists for testing a tier under
    // conditions that would otherwise trigger a panic/heavy-frame drop.
    this.locked = false;

    this.previousTimestampMs = null;
    this.latestFrameMs = 0;
    this.lastAdjustmentReason = 'startup';
    this.onQualityDowngrade = onQualityDowngrade;
    this.onQualityUpgrade = onQualityUpgrade;
    this.onWarmupComplete = onWarmupComplete;
    this.onMediumProbeComplete = onMediumProbeComplete;
  }

  setTier(tier, { startCooldown = true } = {}) {
    if (!this.tiers.includes(tier)) return;

    this.currentTier = tier;
    this.heavyFrameTimestamps.length = 0;
    this.upgradeStableElapsedMs = 0;
    this.ignoredFramesRemaining = this.ignoredFramesAfterChange;
    if (tier !== 'medium') {
      this.mediumProbeActive = false;
      this.mediumProbeElapsedMs = 0;
      this.mediumProbeHeavyFrames = 0;
    }
    if (startCooldown) {
      this.cooldownRemainingMs = this.cooldownMs;
    }
  }

  // Pin the tier to a hand-picked choice. Auto-downgrade survives; auto-upgrade
  // and the medium probe do not.
  setUserTier(tier) {
    if (!this.tiers.includes(tier)) return;

    this.userPinned = true;
    // An explicit choice outranks the manager's memory of what failed. Picking a
    // tier by hand is allowed to reach above the ceiling, and clears it, so that
    // letting the manager take over again later does not start from a verdict
    // reached before the choice was made.
    this.tierCeiling = null;
    this.mediumProbeActive = false;
    this.mediumProbeElapsedMs = 0;
    this.mediumProbeHeavyFrames = 0;
    // A hand-picked tier is also an answer to the benchmark. Leaving warmup
    // incomplete would let it finish later and move the tier out from under
    // the choice that was just made.
    this.warmupComplete = true;
    this.lastAdjustmentReason = 'user-selected';
    this.setTier(tier);
  }

  clearUserTier() {
    this.userPinned = false;
  }

  setLocked(locked) {
    this.locked = locked;
  }

  /**
   * @param {number} timestampMs
   * @param {object} [options]
   * @param {boolean} [options.representative] - whether this frame is drawn
   *   from a part of the journey whose cost is worth judging by. Defaults to
   *   true, so a caller that says nothing behaves as before.
   *
   *   Only the upgrade path reads it. Downgrades never do: a frame that has
   *   fallen apart has fallen apart wherever it was drawn, and protection is not
   *   conditional on where the visitor happens to be.
   */
  update(timestampMs = performance.now(), { representative = true } = {}) {
    this.frameIsRepresentative = representative;

    if (this.previousTimestampMs === null) {
      this.previousTimestampMs = timestampMs;
      return;
    }

    const frameMs = timestampMs - this.previousTimestampMs;
    this.previousTimestampMs = timestampMs;
    this.latestFrameMs = frameMs;

    if (frameMs <= 0) return;

    // Check the benchmark deadline before any early return can skip it.
    if (!this.warmupComplete) {
      if (this.benchmarkStartedAtMs === null) this.benchmarkStartedAtMs = timestampMs;
      const benchmarkElapsedMs =
        timestampMs - this.benchmarkStartedAtMs - this.benchmarkHiddenMs;
      if (benchmarkElapsedMs >= this.benchmarkDeadlineMs) {
        this.completeWarmup('benchmark-deadline');
        return;
      }
    }

    // Long gaps come from tab suspension, sleep, or debugger pauses. They are
    // not valid GPU samples and must never trigger panic downgrades.
    if (frameMs > this.maxFrameGapMs) {
      this.resetTiming(timestampMs);
      return;
    }

    // Tier changes recompile shaders and resize render targets. Ignore those
    // deliberately expensive transition frames before judging the new tier.
    if (this.ignoredFramesRemaining > 0) {
      this.ignoredFramesRemaining--;
      return;
    }

    if (!this.warmupComplete) {
      this.updateWarmup(frameMs);
      return;
    }

    if (this.cooldownRemainingMs > 0) {
      this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - frameMs);

      // Panic frames indicate a backed-up GPU queue; downgrade even in cooldown.
      if (frameMs > this.panicFrameMs) {
        if (this.mediumProbeActive) this.failMediumProbe();
        else this.downgrade('panic');
      }
      return;
    }

    if (frameMs > this.panicFrameMs) {
      if (this.mediumProbeActive) this.failMediumProbe();
      else this.downgrade('panic');
      return;
    }

    if (this.mediumProbeActive) {
      this.updateMediumProbe(frameMs);
      return;
    }

    if (frameMs > this.heavyFrameMs) {
      this.upgradeStableElapsedMs = 0;
      this.recordHeavyFrame(timestampMs);

      const heavyLimit = this.currentTier === 'medium'
        ? this.mediumHeavyFrameLimit
        : this.heavyFrameLimit;

      if (this.heavyFrameTimestamps.length > heavyLimit) {
        this.downgrade('heavy-frame-budget');
      }
      return;
    }

    this.pruneHeavyFrames(timestampMs);

    if (frameMs < this.healthyFrameMs) {
      this.trackUpgradeHeadroom(frameMs);
      return;
    }

    this.upgradeStableElapsedMs = 0;
  }

  updateWarmup(frameMs) {
    this.warmupElapsedMs += frameMs;

    // Every frame is kept so the verdict can be a percentile rather than a
    // count. Three seconds is a few hundred samples at worst, which is nothing.
    this.warmupFrameTimes.push(frameMs);

    // Still counted, but only for the log line. Nothing decides on these any
    // more - see completeWarmup.
    if (frameMs > this.panicFrameMs) {
      this.warmupPanicFrames++;
    }

    if (frameMs > this.heavyFrameMs) {
      this.warmupHeavyFrames++;
    }

    if (this.warmupElapsedMs < this.warmupMs) return;

    this.completeWarmup('warmup-elapsed');
  }

  /** The frame time that `fraction` of warmup's frames came in under. */
  warmupPercentile(fraction) {
    if (this.warmupFrameTimes.length === 0) return null;
    const sorted = [...this.warmupFrameTimes].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(fraction * sorted.length) - 1)
    );
    return sorted[index];
  }

  completeWarmup(reason) {
    if (this.warmupComplete) return;

    this.warmupComplete = true;
    this.lastAdjustmentReason = reason;
    this.onWarmupComplete({
      tier: this.currentTier,
      heavyFrames: this.warmupHeavyFrames,
      panicFrames: this.warmupPanicFrames,
      // The number the decision is actually made on, so the log line explains
      // the verdict instead of just reporting the outliers it ignored.
      p90: this.warmupPercentile(0.9),
      frames: this.warmupFrameTimes.length,
      reason,
    });

    // A timed-out benchmark never reached updateWarmup, so its heavy/panic
    // counters are zero for the worst devices rather than the best ones. Reading
    // them as headroom would upgrade exactly the hardware that just failed to
    // render — drop to the safest tier instead.
    if (reason === 'benchmark-deadline') {
      if (this.currentTier !== 'low') this.downgrade('benchmark-deadline');
      return;
    }

    // Judged on a percentile, not on a count of bad frames.
    //
    // Counting outliers reads the startup rather than the scene. Warmup is the
    // one stretch where transients are guaranteed - ~10MB of texture uploading
    // to the GPU on first sample, shader variants compiling, hydration
    // finishing, GPU clocks still ramping - and the old rule downgraded on
    // `warmupPanicFrames > 0`, a single frame over 50ms anywhere in three
    // seconds, with no budget at all. That made warmup stricter than the live
    // path, which tolerates five heavy frames in a rolling 1.5s window.
    //
    // Measured: a plugged-in laptop rendering this pose at 7.0ms produced ~348
    // warmup frames, of which 336 sat on the 143fps cap and 12 did not. Twelve
    // startup frames outvoted three hundred and thirty-six, and a machine with
    // headroom for `high` was told it was a `low` device. It also explains the
    // noise - the same phone landing on medium one run and low the next was
    // never measuring the device, only how unlucky its first three seconds were.
    //
    // p90 asks the question the tier decision actually asks: is most of this
    // fast enough. It needs no guess about when transients happen, which matters
    // because clock ramping is not confined to the opening frames.
    const p90 = this.warmupPercentile(0.9);

    if (p90 === null) return;

    if (p90 < this.healthyFrameMs) {
      if (this.currentTier === 'low') {
        this.startMediumProbe();
      } else if (this.currentTier === 'medium' && this.allowHighAutoUpgrade) {
        this.upgrade('warmup-headroom');
      }
    } else if (p90 > this.heavyFrameMs) {
      this.downgrade('warmup-struggling');
    }
    // Between the two bars: the tier it warmed up at is the right one. Stay.
  }

  trackUpgradeHeadroom(frameMs) {
    // A cheap frame is not evidence of headroom unless it came from an
    // expensive part of the journey.
    //
    // This is the same mistake the benchmark used to make, in the one place it
    // survived being fixed. The benchmark now judges the device on the fall
    // instead of the wormhole; this path was still counting whatever happened
    // to be on screen. At scroll zero the wormhole is the cheapest thing the
    // scene draws, so eight seconds of sitting still there is guaranteed
    // headroom - and the tier it buys is one the fall cannot hold. Measured on
    // an iPhone 16 Pro: idle at the opening climbs to high, scrolling into the
    // fall drops it straight back to medium, and it will do that all day.
    //
    // Paused rather than reset. Coming back up out of the fall should not spend
    // credit that was honestly earned in it - it should simply stop earning
    // more until the journey is somewhere worth measuring again.
    if (!this.frameIsRepresentative) return;

    if (this.userPinned) {
      this.upgradeStableElapsedMs = 0;
      return;
    }

    if (this.isHighestTier()) {
      this.upgradeStableElapsedMs = 0;
      return;
    }

    this.upgradeStableElapsedMs += frameMs;

    if (this.currentTier === 'low' && this.upgradeStableElapsedMs >= this.lowToMediumProbeMs) {
      this.startMediumProbe();
      return;
    }

    if (
      this.currentTier === 'medium' &&
      this.allowHighAutoUpgrade &&
      this.upgradeStableElapsedMs >= this.upgradeStableMs
    ) {
      this.upgrade('sustained-headroom');
    }
  }

  // Returns whether the probe actually started. Callers that wait on
  // onMediumProbeComplete have to know when it refused, or they wait forever.
  startMediumProbe() {
    if (this.userPinned || this.locked || this.mediumProbeRejected) return false;
    // The probe reaches medium through setTier rather than upgrade(), so the
    // ceiling has to be checked here too or it would be the one way around it.
    if (this.tierCeiling !== null && this.tiers.indexOf('medium') > this.tiers.indexOf(this.tierCeiling)) {
      return false;
    }

    this.lastAdjustmentReason = 'low-to-medium-probe';
    this.mediumProbeActive = true;
    this.mediumProbeElapsedMs = 0;
    this.mediumProbeHeavyFrames = 0;
    this.setTier('medium', { startCooldown: false });
    this.cooldownRemainingMs = 0;
    this.mediumProbeActive = true;
    this.onQualityUpgrade('medium', { reason: 'low-to-medium-probe' });
    return true;
  }

  updateMediumProbe(frameMs) {
    this.mediumProbeElapsedMs += frameMs;

    if (frameMs > this.heavyFrameMs) {
      this.mediumProbeHeavyFrames++;
    }

    if (this.mediumProbeHeavyFrames > this.mediumHeavyFrameLimit) {
      this.failMediumProbe();
      return;
    }

    if (this.mediumProbeElapsedMs >= this.mediumProbeEvaluationMs) {
      this.mediumProbeActive = false;
      this.mediumProbeElapsedMs = 0;
      this.mediumProbeHeavyFrames = 0;
      this.cooldownRemainingMs = this.cooldownMs;
      this.onMediumProbeComplete({ accepted: true, tier: 'medium' });
    }
  }

  failMediumProbe() {
    this.lastAdjustmentReason = 'medium-probe-failed';
    // Asked and answered. The device has now rendered medium and could not hold
    // it, and nothing about that will change while the page is open, so the
    // cooldown is not a waiting period before trying again - there is nothing
    // left to try. Without this the probe is a loop: climb, fail, wait out the
    // cooldown, climb again, every half minute for as long as the visitor is
    // scrolling, each pass a visible jump in quality and a visible collapse.
    this.mediumProbeRejected = true;
    this.mediumProbeActive = false;
    this.mediumProbeElapsedMs = 0;
    this.mediumProbeHeavyFrames = 0;
    this.setTier('low', { startCooldown: false });
    this.cooldownRemainingMs = this.failedProbeCooldownMs;
    this.onQualityDowngrade('low', { reason: 'medium-probe-failed' });
    this.onMediumProbeComplete({ accepted: false, tier: 'low' });
  }

  downgrade(reason) {
    if (this.locked) return;

    const tierIndex = this.tiers.indexOf(this.currentTier);
    if (tierIndex <= 0) {
      this.heavyFrameTimestamps.length = 0;
      this.upgradeStableElapsedMs = 0;
      return;
    }

    const nextTier = this.tiers[tierIndex - 1];

    // Warmup is not allowed to cap anything, and getting this wrong cost an
    // iPhone 16 Pro its whole session.
    //
    // The benchmark runs for three seconds while textures are still decoding and
    // two shader variants are compiling - the most contended moment there is -
    // and it is noisy enough to land on medium one run and low the next on the
    // same hardware. When a warmup downgrade set the ceiling, that coin flip
    // became permanent: the manager dropped to low, the medium probe that exists
    // to recover a conservative start was refused by the ceiling, and the phone
    // sat at low for the rest of the session at 50-60fps with headroom it could
    // never spend.
    //
    // A ceiling is meant to record "this device rendered this tier and could not
    // hold it", not "this device had a rough three seconds while loading".
    const isWarmupVerdict = reason === 'warmup-struggling' || reason === 'benchmark-deadline';

    // Asked and answered, the same rule a failed medium probe already follows.
    // This tier has now been rendered on this device and could not be held, so
    // the automatic path stops offering it.
    //
    // Without this the manager cannot help but retry it. Headroom at the current
    // tier is the only evidence it has, and headroom at one tier says nothing
    // about the next one when the rungs are roughly twice each other's cost.
    // A device where medium is comfortable in the fall and high is not will
    // climb, fail, drop, wait out the cooldown and climb again for as long as
    // the visitor stays - which is what an iPhone 16 Pro actually does here.
    //
    // The visitor can still pick any tier by hand; this governs only what the
    // manager reaches for on its own.
    if (!isWarmupVerdict) this.tierCeiling = nextTier;

    this.lastAdjustmentReason = reason;
    // The frame that triggered this, read before setTier clears the timing
    // state. A `panic` reason without its frame time cannot be told apart from
    // a render-target reallocation, which is exactly the question open here.
    const frameMs = this.latestFrameMs;
    this.setTier(nextTier);
    this.onQualityDowngrade(nextTier, { reason, frameMs });
  }

  upgrade(reason) {
    if (this.locked) {
      this.upgradeStableElapsedMs = 0;
      return;
    }

    if (this.userPinned) {
      this.upgradeStableElapsedMs = 0;
      return;
    }

    const tierIndex = this.tiers.indexOf(this.currentTier);
    if (tierIndex < 0 || tierIndex >= this.tiers.length - 1) {
      this.upgradeStableElapsedMs = 0;
      return;
    }

    const nextTier = this.tiers[tierIndex + 1];

    // Never climb back above a tier that has already failed here.
    if (this.tierCeiling !== null && this.tiers.indexOf(nextTier) > this.tiers.indexOf(this.tierCeiling)) {
      this.upgradeStableElapsedMs = 0;
      return;
    }

    this.lastAdjustmentReason = reason;
    this.setTier(nextTier);
    this.onQualityUpgrade(nextTier, { reason });
  }

  isHighestTier() {
    return this.currentTier === this.tiers[this.tiers.length - 1];
  }

  resetTiming(timestampMs = null) {
    // A null timestamp means the page went away (hidden tab, suspension). Bank
    // that stretch so it cannot be charged against the benchmark deadline —
    // otherwise a visitor who switches tabs during load returns to a device that
    // was judged on time it never got to render in.
    if (timestampMs === null) {
      if (this.hiddenAtMs === null) this.hiddenAtMs = performance.now();
    } else if (this.hiddenAtMs !== null) {
      this.benchmarkHiddenMs += performance.now() - this.hiddenAtMs;
      this.hiddenAtMs = null;
    }

    this.previousTimestampMs = timestampMs;
    this.heavyFrameTimestamps.length = 0;
    this.upgradeStableElapsedMs = 0;
  }

  recordHeavyFrame(timestampMs) {
    this.heavyFrameTimestamps.push(timestampMs);
    this.pruneHeavyFrames(timestampMs);
  }

  pruneHeavyFrames(timestampMs) {
    const cutoff = timestampMs - this.heavyFrameWindowMs;
    while (
      this.heavyFrameTimestamps.length > 0 &&
      this.heavyFrameTimestamps[0] < cutoff
    ) {
      this.heavyFrameTimestamps.shift();
    }
  }

  getDiagnostics() {
    return {
      tier: this.currentTier,
      frameMs: this.latestFrameMs,
      heavyFrames: this.heavyFrameTimestamps.length,
      cooldownMs: this.cooldownRemainingMs,
      probeActive: this.mediumProbeActive,
      probeElapsedMs: this.mediumProbeElapsedMs,
      probeHeavyFrames: this.mediumProbeHeavyFrames,
      warmupComplete: this.warmupComplete,
      userPinned: this.userPinned,
      reason: this.lastAdjustmentReason,
    };
  }
}
