/**
 * Aplica soft-delete automático a un schema de Mongoose.
 * - Los queries find* excluyen documentos con deleted:true salvo que lo indiquen explícitamente.
 * - Añade estático findDeleted(filter) para listar solo los borrados.
 */
export function applySoftDelete(schema) {
  schema.pre(/^find/, function () {
    if (!Object.prototype.hasOwnProperty.call(this._conditions, 'deleted')) {
      this.where({ deleted: { $ne: true } });
    }
  });

  schema.statics.findDeleted = function (filter = {}) {
    return this.find({ ...filter, deleted: true });
  };
}
