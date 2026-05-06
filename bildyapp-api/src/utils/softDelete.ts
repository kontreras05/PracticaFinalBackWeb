import { Schema } from 'mongoose';

export function applySoftDelete(schema: Schema): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema.pre(/^find/, function (this: any) {
    if (!Object.prototype.hasOwnProperty.call(this._conditions, 'deleted')) {
      this.where({ deleted: { $ne: true } });
    }
  });

  schema.statics['findDeleted'] = function (filter: Record<string, unknown> = {}) {
    return this.find({ ...filter, deleted: true });
  };
}
