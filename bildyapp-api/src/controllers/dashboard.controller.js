/**
 * Importamos el modelo de DeliveryNote (Albaranes) porque las estadísticas
 * del dashboard se basan en sumar albaranes, horas y materiales.
 */
import { DeliveryNote } from '../models/DeliveryNote.js';
// Importamos la utilidad AppError para poder devolver errores limpios y estructurados
import AppError from '../utils/AppError.js';

/**
 * Controlador principal (y único) del dashboard.
 * Recopila datos de los albaranes y los agrupa (agrega) de tres formas distintas:
 * por mes, por cliente y por proyecto.
 */
export const getDashboard = async (req, res, next) => {
  try {
    // 1. Extraemos el ID de la empresa del usuario autenticado
    const companyId = req.user.company;
    
    // Si el usuario no tiene empresa asociada, no puede ver estadísticas de la misma
    if (!companyId) return next(AppError.badRequest('No estás asociado a ninguna empresa.'));

    // 2. Preparamos las etapas de agregación (Aggregation Framework de MongoDB)
    
    // Etapa inicial: Solo queremos los documentos que pertenezcan a esta empresa
    // y que NO estén marcados como borrados (deleted).
    const matchStage = { $match: { company: companyId, deleted: { $ne: true } } };
    
    // Expresión para sumar horas: Si el formato es 'hours', suma el valor del campo 'hours' (o 0 si es nulo).
    // Si el formato no es 'hours', suma 0.
    const hoursExpr = { $cond: [{ $eq: ['$format', 'hours'] }, { $ifNull: ['$hours', 0] }, 0] };
    
    // Expresión para sumar materiales: Si el formato es 'material', suma la 'quantity' (o 0). Si no, 0.
    const materialExpr = { $cond: [{ $eq: ['$format', 'material'] }, { $ifNull: ['$quantity', 0] }, 0] };

    // 3. Ejecutamos las tres consultas a la vez usando Promise.all para que sean en paralelo (más rápido)
    const [byMonth, byClient, byProject] = await Promise.all([
      
      // -- Agregación 1: Estadísticas por MES y AÑO --
      DeliveryNote.aggregate([
        matchStage, // Filtramos por empresa y activos
        {
          // Agrupamos usando el año y el mes extraídos de 'workDate' (Fecha de trabajo)
          $group: {
            _id: { year: { $year: '$workDate' }, month: { $month: '$workDate' } },
            totalAlbaranes: { $sum: 1 },         // Contamos cuántos albaranes hay (+1 por cada uno)
            totalHoras: { $sum: hoursExpr },     // Sumamos las horas calculadas
            totalMaterial: { $sum: materialExpr }, // Sumamos las cantidades de material
          },
        },
        // Ordenamos los resultados: los años más recientes primero y los meses más recientes primero
        { $sort: { '_id.year': -1, '_id.month': -1 } },
      ]),

      // -- Agregación 2: Estadísticas por CLIENTE --
      DeliveryNote.aggregate([
        matchStage,
        {
          // Agrupamos por el ID del cliente
          $group: {
            _id: '$client',
            totalAlbaranes: { $sum: 1 },
            totalHoras: { $sum: hoursExpr },
            totalMaterial: { $sum: materialExpr },
          },
        },
        // Hacemos un "JOIN" (lookup) con la colección 'clients' para traernos los datos del cliente
        { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'client' } },
        // Desarmamos el array que genera el lookup para quedarnos con un objeto
        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
        // Seleccionamos qué campos devolver finalmente al frontend
        { $project: { clientName: '$client.name', clientCif: '$client.cif', totalAlbaranes: 1, totalHoras: 1, totalMaterial: 1 } },
      ]),

      // -- Agregación 3: Estadísticas por PROYECTO --
      DeliveryNote.aggregate([
        matchStage,
        {
          // Agrupamos por el ID del proyecto
          $group: {
            _id: '$project',
            totalAlbaranes: { $sum: 1 },
            totalHoras: { $sum: hoursExpr },
            totalMaterial: { $sum: materialExpr },
          },
        },
        // Hacemos un "JOIN" con la colección 'projects'
        { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        // Moldeamos la respuesta
        { $project: { projectName: '$project.name', projectCode: '$project.projectCode', totalAlbaranes: 1, totalHoras: 1, totalMaterial: 1 } },
      ]),
    ]);

    // 4. Si todas las consultas salen bien, respondemos con código 200 y los datos
    res.status(200).json({
      status: 'success',
      data: { byMonth, byClient, byProject },
    });
  } catch (error) {
    // Si hay un error, lo enviamos al middleware de manejo de errores
    next(error);
  }
};
