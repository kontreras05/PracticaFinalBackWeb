import { DeliveryNote } from '../models/DeliveryNote.js';
import { Client } from '../models/Client.js';
import { Project } from '../models/Project.js';
import { paginate } from '../services/pagination.service.js';
import { uploadBuffer } from '../services/storage.service.js';
import { generateDeliveryNotePDF } from '../services/pdf.service.js';
import { notificationService } from '../services/notification.service.js';
import AppError from '../utils/AppError.js';

/**
 * Crea un nuevo albarán (delivery note).
 * Valida que el cliente y el proyecto especificados existan y pertenezcan a la empresa del usuario actual.
 * Si la creación es exitosa, emite una notificación.
 * 
 * @param {Object} req - Objeto de petición Express.
 * @param {Object} res - Objeto de respuesta Express.
 * @param {Function} next - Middleware para el manejo de errores.
 */
export const createDeliveryNote = async (req, res, next) => {
  try {
    // Extraemos los IDs de cliente y proyecto del cuerpo de la petición, así como el resto de datos
    const { client: clientId, project: projectId, ...rest } = req.body;
    // Obtenemos el ID del usuario creador y el ID de su empresa desde el token de autenticación (req.user)
    const { _id: userId, company: companyId } = req.user;

    // Verificamos de forma paralela si el cliente y el proyecto pertenecen a la misma empresa
    const [client, project] = await Promise.all([
      Client.findOne({ _id: clientId, company: companyId }),
      Project.findOne({ _id: projectId, company: companyId }),
    ]);
    
    // Si no existen o no pertenecen a la empresa, lanzamos un error 404
    if (!client) return next(AppError.notFound('Cliente no encontrado en tu empresa.'));
    if (!project) return next(AppError.notFound('Proyecto no encontrado en tu empresa.'));

    // Creamos el albarán en la base de datos con los datos recibidos
    const note = await DeliveryNote.create({
      user: userId,
      company: companyId,
      client: clientId,
      project: projectId,
      ...rest,
    });

    // Emitimos evento para que el sistema de notificaciones (por ejemplo webhooks/websockets) actúe
    notificationService.emit('deliverynote:new', {
      id: String(note._id),
      companyId: String(companyId),
    });

    // Respondemos con código HTTP 201 (Created) y el albarán creado
    res.status(201).json({ status: 'success', data: { deliveryNote: note } });
  } catch (error) {
    // Pasamos cualquier error inesperado al middleware de errores
    next(error);
  }
};

/**
 * Obtiene una lista paginada y filtrada de albaranes de la empresa del usuario.
 * Soporta filtros por proyecto, cliente, formato, estado de firma y rango de fechas.
 */
export const listDeliveryNotes = async (req, res, next) => {
  try {
    // Obtenemos parámetros de consulta (query) y de paginación
    const { page, limit, project, client, format, signed, from, to, sort } = req.query;
    const companyId = req.user.company;

    // Construimos el filtro base (siempre limitado a la empresa del usuario)
    const filter = { company: companyId };
    
    // Agregamos condicionalmente al filtro los parámetros recibidos
    if (project) filter.project = project;
    if (client) filter.client = client;
    if (format) filter.format = format;
    if (signed !== undefined) filter.signed = signed;
    
    // Filtro por rango de fechas (fecha en la que se realizó el trabajo)
    if (from || to) {
      filter.workDate = {};
      if (from) filter.workDate.$gte = from; // Mayor o igual que 'from'
      if (to) filter.workDate.$lte = to;     // Menor o igual que 'to'
    }

    // Utilizamos el servicio de paginación pasándole el modelo, el filtro y las opciones
    const result = await paginate(DeliveryNote, filter, { page, limit, sort });
    
    // Respondemos con la lista de albaranes y los metadatos de paginación
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene los detalles de un albarán específico por su ID.
 * Hace "populate" de las referencias para devolver los datos completos en lugar de solo los IDs.
 */
export const getDeliveryNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    // Buscamos el albarán, asegurándonos de que pertenezca a la empresa del usuario
    // Rellenamos (populate) los campos referenciados para incluir información detallada
    const note = await DeliveryNote.findOne({ _id: id, company: companyId })
      .populate('user', 'name lastName email')
      .populate('client', 'name cif email phone')
      .populate('project', 'name projectCode');

    // Si no se encuentra el albarán, devolvemos un error 404
    if (!note) return next(AppError.notFound('Albarán no encontrado.'));

    // Respondemos con los datos del albarán
    res.status(200).json({ status: 'success', data: { deliveryNote: note } });
  } catch (error) {
    next(error);
  }
};

/**
 * Genera o devuelve el PDF de un albarán específico.
 * Si el albarán ya tiene un PDF generado y firmado (URL), redirige a dicha URL.
 * Si no, genera el buffer del PDF al vuelo y lo envía al cliente.
 */
export const getDeliveryNotePDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    // Buscamos el albarán rellenando todos los campos necesarios para mostrarlos en el documento PDF
    const note = await DeliveryNote.findOne({ _id: id, company: companyId })
      .populate('user', 'name lastName email')
      .populate('client', 'name cif email phone address')
      .populate('project', 'name projectCode notes')
      .populate('company', 'name cif address logo');

    if (!note) return next(AppError.notFound('Albarán no encontrado.'));

    // Si ya existe un PDF almacenado (ej. porque ya fue firmado y guardado),
    // redirigimos directamente a la URL pública del PDF
    if (note.pdfUrl) {
      return res.redirect(note.pdfUrl);
    }

    // Si no tiene URL de PDF, generamos el PDF de manera dinámica (on-the-fly) en memoria
    const pdfBuffer = await generateDeliveryNotePDF(note);

    // Configuramos las cabeceras HTTP para que el navegador sepa que es un archivo PDF
    // e intente mostrarlo directamente (inline) o inicie su descarga
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="albaran-${note._id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    
    // Enviamos el archivo binario
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Firma digitalmente un albarán.
 * Recibe una imagen (la firma), la sube al almacenamiento, marca el albarán como firmado,
 * genera su versión PDF definitiva (con firma incrustada) y sube este PDF también.
 */
export const signDeliveryNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    // Verificamos que se haya enviado un archivo en la petición (la imagen de la firma enviada via multer)
    if (!req.file) return next(AppError.badRequest('Se requiere una imagen de firma.'));

    // Buscamos el albarán poblando todos sus datos, ya que los necesitaremos para generar el PDF final
    const note = await DeliveryNote.findOne({ _id: id, company: companyId })
      .populate('user', 'name lastName email')
      .populate('client', 'name cif email phone address')
      .populate('project', 'name projectCode notes')
      .populate('company', 'name cif address logo');

    if (!note) return next(AppError.notFound('Albarán no encontrado.'));
    
    // Validamos que el albarán no haya sido firmado previamente
    if (note.signed) return next(AppError.conflict('El albarán ya está firmado.'));

    // 1. Subimos la imagen de la firma (la optimización de la imagen se maneja dentro de storage.service)
    const signaturePublicId = `signatures/${String(companyId)}/${id}`;
    const signatureUrl = await uploadBuffer(req.file.buffer, signaturePublicId, req.file.mimetype);

    // 2. Preparamos los campos del modelo en memoria antes de guardar
    // Se hace una sola vez para evitar problemas o bloqueos con los pre-hooks de Mongoose
    note.signatureUrl = signatureUrl;
    note.signed = true;
    note.signedAt = new Date(); // Registramos la fecha y hora de la firma

    // 3. Generamos el PDF con los datos poblados y la URL de la firma ya asignada en memoria
    const pdfBuffer = await generateDeliveryNotePDF(note);
    
    // 4. Subimos el documento PDF definitivo generado al almacenamiento (ej. AWS S3, Cloudinary)
    const pdfPublicId = `pdfs/${String(companyId)}/${id}`;
    const pdfUrl = await uploadBuffer(pdfBuffer, pdfPublicId, 'application/pdf');

    // Asignamos la URL pública del PDF final al albarán y lo guardamos en la base de datos
    note.pdfUrl = pdfUrl;
    await note.save();

    // Notificamos que el albarán ha sido firmado exitosamente (útil para dashboards en tiempo real, emails)
    notificationService.emit('deliverynote:signed', {
      id: String(note._id),
      companyId: String(companyId),
      pdfUrl,
    });

    res.status(200).json({ status: 'success', data: { deliveryNote: note } });
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina un albarán.
 * Permite tanto el borrado lógico (soft delete) como el borrado físico, según el parámetro query 'soft'.
 * Por seguridad y control, bloquea la eliminación si el albarán ya ha sido firmado.
 */
export const deleteDeliveryNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Por defecto realizamos un "soft delete", a menos que se especifique explicitamente '?soft=false'
    const soft = req.query.soft !== 'false';
    const companyId = req.user.company;

    const note = await DeliveryNote.findOne({ _id: id, company: companyId });
    if (!note) return next(AppError.notFound('Albarán no encontrado.'));
    
    // Regla de negocio crucial: un albarán ya firmado es inmutable y no se puede eliminar
    if (note.signed) return next(AppError.conflict('No se puede eliminar un albarán firmado.'));

    if (soft) {
      // Borrado lógico: marcamos el albarán como eliminado, pero lo conservamos en base de datos
      note.deleted = true;
      await note.save();
    } else {
      // Borrado físico: eliminamos el registro permanentemente de la colección
      await DeliveryNote.findByIdAndDelete(id);
    }

    // Retornamos HTTP 204 (No Content), indicando que la operación se realizó con éxito sin datos que devolver
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
