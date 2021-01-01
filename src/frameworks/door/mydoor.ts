import { User, Actor, Color4, Color3, AlphaMode, ColliderType, CollisionLayer } from "@microsoft/mixed-reality-extension-sdk";
import BasicDoor from "./door";
import { ContextLike } from "../../frameworks/context/types";
import { DoorStructure } from "./types";

export default class MyDoor extends BasicDoor {
    private trigger: Actor;
    private triggerToUser: Map<Actor, User>;

    public get root() { return this.doorRoot; }

    public addUser(user: User, trigger: Actor){
        this.triggerToUser.set(trigger, user);
    }

    public removeUser(trigger: Actor){
        this.triggerToUser.delete(trigger);
    }

    public started(ctx: ContextLike, source: string | DoorStructure) {
        super.started(ctx, source);

        this.triggerToUser = new Map<Actor, User>();
        const transMat = ctx.assets.createMaterial('trans_red', {
            color: Color4.FromColor3(Color3.Red(), 0.1), alphaMode: AlphaMode.Blend
        });

        console.log('this is my door');
        this.trigger = Actor.Create(ctx.baseContext, {
            actor: {
                name: "trigger",
                appearance: {
                    meshId: ctx.assets.createBoxMesh('trigger', 2, 1, 2).id,
                    materialId: transMat.id
                },
                transform: {
                    local: { position: {x:0, y:0, z:0} }
                },
                collider: {
                    isTrigger: true,
                    geometry: { shape: ColliderType.Auto },
                    layer: CollisionLayer.Hologram
                }
            }
        });

        this.trigger.collider.onTrigger("trigger-enter", (actor)=>{
            const user = this.triggerToUser.get(actor);
            this.handlePressed(user);
            console.log('user',user.name,'entered');
        });
    }
}

