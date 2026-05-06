/**
 * @param {import('mongoose').Model} model
 * @param {object} filter
 * @param {{ page?: number, limit?: number, sort?: string|object, populate?: string|object }} options
 */
export const paginate = async (model, filter = {}, { page = 1, limit = 10, sort, populate } = {}) => {
  const skip = (page - 1) * limit;

  const query = model.find(filter).skip(skip).limit(limit);
  if (sort) query.sort(sort);
  if (populate) query.populate(populate);

  const [items, totalItems] = await Promise.all([query.exec(), model.countDocuments(filter)]);

  return {
    items,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    currentPage: page,
  };
};
