/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    AnimationKeyframe,
    DegreesToRadians,
    Quaternion,
    SoundInstance,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import {
    GateStatus,
} from "./sg_types";

import { delay, initSound, restartSound } from "../helpers";

import Stargate from "./sg_main";

export default class StargateSG1 extends Stargate {

    private gateRing: Actor = null;
    private gateRingAngle = 0;
    private gateChevrons: Actor[] = [ null, null, null, null, null, null, null, null, null ];
    private chevronAngles: number[] = [ 240, 280, 320, 0, 40, 80, 120, 160, 200 ];

    private gateFrameId = 'artifact:1144171771746845684';
    private gateRingId = 'artifact:1144171766839510003';
    private gateChevronLitId = 'artifact:1144171760086680562';
    private gateChevronUnlitId = 'artifact:1144171776629015542';

    private externBaseURL = 'https://raw.githubusercontent.com/willneedit/willneedit.github.io/master/MRE/stargate';
    private soundChevronLockURL = `${this.externBaseURL}/SG_Chevron_lock.wav`;
    private soundGateTurningURL = `${this.externBaseURL}/SG_Turn_Grind.wav`;

    private soundChevronLock: SoundInstance = null;
    private soundGateTurning: SoundInstance = null;

    /**
     * Light up or switch off the given chevron
     * @param index No. of chevron (0-8)
     * @param state lit state
     */
    private async replaceChevron(index: number, state: boolean): Promise<void> {

        const oldChevron = this.gateChevrons[index];

        this.gateChevrons[index] = Actor.CreateEmpty(
            this.context,
            {
                actor: {
                    name: 'Gate Chevron ' + index,
                    transform: { rotation: Quaternion.RotationAxis(
                        Vector3.Forward(), this.chevronAngles[index] * DegreesToRadians) }
                }
            }).value;

        const chevronModel = Actor.CreateFromLibrary(this.context,
            {
                resourceId: (state ? this.gateChevronLitId : this.gateChevronUnlitId),
                actor: {
                    parentId: this.gateChevrons[index].id
                }
            });

        await chevronModel;

        if (oldChevron != null) oldChevron.destroy();
    }

    /**
     * Reset the gate to its idle state
     */
    protected async resetGate(): Promise<void> {
        await super.resetGate();
        for (let i = 0; i < 9; ++i) {
            this.replaceChevron(i, false);
        }
    }

    /**
     * Initialize the gate and set up the models.
     */
    protected async initGate(): Promise<void> {
        Actor.CreateFromLibrary(this.context,
            {
                resourceId: this.gateFrameId,
                actor: {
                    name: 'Gate Frame'
                }
            }
        );

        this.gateRing = Actor.CreateFromLibrary(this.context,
            {
                resourceId: this.gateRingId,
                actor: {
                    name: 'Gate Ring'
                }
            }
        ).value;

        this.soundGateTurning = initSound(this.gateRing, this.soundGateTurningURL, { looping: true }).value;
        this.soundChevronLock = initSound(this.gateRing, this.soundChevronLockURL).value;

        this.resetGate();

    }

    /**
     * Generate the rotation animation for the ring. Calculate the keyframes for the uniform
     * acceleration of the angular speed to a given max speed and its slowing down to a stop
     * at the target angle, then integrate over the speed to get the actual angle values
     * for the given time indices.
     *
     * Same as we'd done that on the good old C64 when smoothly moving sprites along a curve.
     * @param srcAngle Angle the ring rotates from
     * @param tgtAngle Angle the ring rotates to
     * @param direction Direction of rotation, true for counter-clockwise
     */
    private generateRotationKeyFrames(

        srcAngle: number, tgtAngle: number, direction: boolean): AnimationKeyframe[] {

        tgtAngle = tgtAngle % 360;
        srcAngle = srcAngle % 360;

        // Sort the angles in a linear fashion, according to the intended movement direction
        if (direction && tgtAngle < srcAngle) tgtAngle = tgtAngle + 360;

        if (!direction && tgtAngle > srcAngle) tgtAngle = tgtAngle - 360;
        const kf: AnimationKeyframe[] = [];

        // Take six seconds for a full revolution at full speed, calculate the time needed to travel the
        // given distance.
        const timescale = 3;
        const angularMaxSpeed = 360 / (6 * timescale); // Angular max speed in degrees/timescale of seconds
        const accelStep = angularMaxSpeed / timescale; // Number of timescale steps (one second) to get to top speed
        let currentAngularSpeed = 0;
        let lastAngularSpeed = 0;
        let accelDist = 0;
        let t = 0;
        const angleDistance = Math.abs(tgtAngle - srcAngle);
        for (let angle = 0; angle <= angleDistance; angle += currentAngularSpeed) {
            // The same distance we covered to accelerate we need to decelerate to a full stop
            if (angle + accelDist >= angleDistance) {
                currentAngularSpeed -= accelStep;
                if (currentAngularSpeed <= accelStep) currentAngularSpeed = accelStep;
            } else if (currentAngularSpeed + accelStep < angularMaxSpeed) {
                currentAngularSpeed += accelStep;
                accelDist = angle;
            }

            // Add a keyframe if the angular speed did change.
//            if (lastAngularSpeed !== currentAngularSpeed) {
            const rAngle = srcAngle + angle * (direction ? 1 : -1);
            const rot =  Quaternion.RotationAxis(Vector3.Forward(), rAngle * DegreesToRadians);
            kf.push({
                    time: t / timescale,
                    value: { transform: { rotation: rot } }
            });
//            }
            t++;

            lastAngularSpeed = currentAngularSpeed;
        }

        kf.push(
            {
                time: (t++) / timescale,
                value: { transform: {
                    rotation: Quaternion.RotationAxis(Vector3.Forward(), tgtAngle * DegreesToRadians)
                } }
            });

        return kf;
    }

    /**
     * Locks in the given chevron
     * @param index Number of Chevron (0-8)
     * @param direction true for incoming
     */
    public async lightChevron(index: number, silent: boolean) {

        // Reject request if we're not dialing
        if (this.gateStatus !== GateStatus.dialing) return;

        await this.replaceChevron(index, true);
        restartSound(this.soundChevronLock);
        await delay(1000);

        if (!silent) this.reportStatus(`${this.currentDirection ? 'Incoming! ' : ''} Chevron ${index + 1} locked in.`);
    }

    /**
     * Dials to one chevron.
     * @param chevron Chevron which needs to be locked in
     * @param symbol Symbol the chevron needs to be locked to
     * @param dialDirection Direction of the rotation
     */
    protected async dialChevron(chevron: number, symbol: number, dialDirection: boolean) {

        // target angle for the ring to show a specific symbol at a given chevron
        const tgtAngle = (this.chevronAngles[chevron] + (symbol * 360 / 39)) % 360;
        const srcAngle = this.gateRingAngle;

        const rotAnim = this.generateRotationKeyFrames(srcAngle, tgtAngle, dialDirection);

        await this.gateRing.createAnimation('rotation', {keyframes: rotAnim, events: []});

        this.gateRing.enableAnimation('rotation');
        this.soundGateTurning.resume();
        await delay(rotAnim[rotAnim.length - 1].time * 1000 + 200);
        this.soundGateTurning.pause();

        await this.gateRing.disableAnimation('rotation');

        this.gateRingAngle = tgtAngle;
    }

}