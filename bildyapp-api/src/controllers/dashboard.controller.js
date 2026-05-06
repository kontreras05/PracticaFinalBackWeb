import { DeliveryNote } from '../models/DeliveryNote.js';
import AppError from '../utils/AppError.js';

export const getDashboard = async (req, res, next) => {
  try {
    const companyId = req.user.company;
    if (!companyId) return next(AppError.badRequest('No estás asociado a ninguna empresa.'));

    const matchStage = { $match: { company: companyId, deleted: { $ne: true } } };
    const hoursExpr = { $cond: [{ $eq: ['$format', 'hours'] }, { $ifNull: ['$hours', 0] }, 0] };
    const materialExpr = { $cond: [{ $eq: ['$format', 'material'] }, { $ifNull: ['$quantity', 0] }, 0] };

    const [byMonth, byClient, byProject] = await Promise.all([
      DeliveryNote.aggregate([
        matchStage,
        {
          $group: {
            _id: { year: { $year: '$workDate' }, month: { $month: '$workDate' } },
            totalAlbaranes: { $sum: 1 },
            totalHoras: { $sum: hoursExpr },
            totalMaterial: { $sum: materialExpr },
          },
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
      ]),
      DeliveryNote.aggregate([
        matchStage,
        {
          $group: {
            _id: '$client',
            totalAlbaranes: { $sum: 1 },
            totalHoras: { $sum: hoursExpr },
            totalMaterial: { $sum: materialExpr },
          },
        },
        { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'client' } },
        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
        { $project: { clientName: '$client.name', clientCif: '$client.cif', totalAlbaranes: 1, totalHoras: 1, totalMaterial: 1 } },
      ]),
      DeliveryNote.aggregate([
        matchStage,
        {
          $group: {
            _id: '$project',
            totalAlbaranes: { $sum: 1 },
            totalHoras: { $sum: hoursExpr },
            totalMaterial: { $sum: materialExpr },
          },
        },
        { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        { $project: { projectName: '$project.name', projectCode: '$project.projectCode', totalAlbaranes: 1, totalHoras: 1, totalMaterial: 1 } },
      ]),
    ]);

    res.status(200).json({
      status: 'success',
      data: { byMonth, byClient, byProject },
    });
  } catch (error) {
    next(error);
  }
};
