import { Attributes } from "Illuminate/Container/Attributes/Attributes";

/** PHP: `#[Attribute(Attribute::TARGET_CLASS)] class DeleteWhenMissingModels`. */
export interface DeleteWhenMissingModels {
    readonly deleteWhenMissingModels: boolean;
}

/**
 * Drop the job instead of failing it when something it carries is gone.
 *
 * PHP means a deleted Eloquent model; here it means an `Instance` that no
 * longer resolves -- a player who has left, a part that was destroyed.
 */
export function DeleteWhenMissingModels(deleteWhenMissingModels = true) {
    return (target: object): void => {
        Attributes.add(target, DeleteWhenMissingModels, {
            deleteWhenMissingModels,
        });
    };
}
