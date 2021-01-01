/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import Applet from "../Applet";
import DoorGuard from "../DoorGuard";

import { ContextLike } from "../frameworks/context/types";

import { ParameterSet, User, Guid, Actor, Color3, Color4, AlphaMode, ColliderType, CollisionLayer } from "@microsoft/mixed-reality-extension-sdk";

import MyDoor from "../frameworks/door/mydoor";
import { DoorStructure } from "../frameworks/door/types";

export default class AutomaticDoor extends Applet {
    private initialized = false;

    private door: MyDoor = null;
    private userTriggers: Map<Guid, Actor>;

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);

        this.userTriggers = new Map<Guid, Actor>();

        this.context.onUserJoined(this.userjoined);
        this.context.onUserLeft(this.userLeft);
        this.context.onStarted(this.started);
        this.context.onStopped(this.stopped);
    }

    private userjoined = async (user: User) => {
        console.debug(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
        if (this.userTriggers.has(user.id)){
            this.userTriggers.get(user.id).destroy();
            this.userTriggers.delete(user.id);
        }
        const transMat = this.context.assets.createMaterial('trans_red', {
            color: Color4.FromColor3(Color3.Red(), 0.1), alphaMode: AlphaMode.Blend
        });
        this.userTriggers.set(user.id, Actor.Create(this.context.baseContext, {
            actor: {
                name: "trigger",
                appearance: {
                    meshId: this.context.assets.createBoxMesh('trigger', 0.6, 0.6, 0.6).id,
                    materialId: transMat.id
                },
                transform: {
                    local: { position: {x:0, y:0, z:0} }
                },
                rigidBody: {
                    isKinematic: true,
                    useGravity: false
                },
                collider: {
                    geometry: { shape: ColliderType.Auto },
                    layer: CollisionLayer.Hologram
                },
                attachment: {
                    attachPoint: "spine-middle",
                    userId: user.id
                }
            }
        }));
        this.door.addUser(user, this.userTriggers.get(user.id));
    }

    private userLeft = async (user: User) => {
        this.userTriggers.get(user.id).destroy();
        this.door.removeUser(this.userTriggers.get(user.id));
    }

    private started = () => {
        this.door = new MyDoor();
        this.door.started(this.context, this.parameter.def as string);
    }

    private stopped = () => {
        this.door.stopped();
    }
}
