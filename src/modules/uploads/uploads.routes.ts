import { Router, type NextFunction, type Request, type Response } from 'express';
import { protect, restrictTo } from '../../core/middlewares/auth.middleware';
import { AppError } from '../../core/errors/AppError';
import { manejar } from '../../core/utils/controlador';
import { almacenCloudinary, almacenImagenes } from './uploads.service';
import { exigirArchivo, recibirImagen } from './uploads.middleware';

// Cada tipo de imagen va a su carpeta dentro de Cloudinary
const CARPETAS = { catalogo: 'catalogo', avatares: 'avatares' } as const;
type Destino = keyof typeof CARPETAS;

const firmarPara = (destino: Destino) =>
  manejar(async (_req, res) => {
    if (!almacenCloudinary) {
      throw new AppError('Cloudinary no esta configurado en el servidor', 503);
    }
    res.status(200).json({ success: true, data: { firma: almacenCloudinary.firmarSubida(CARPETAS[destino]) } });
  });

const subirImagen = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imagen = await almacenImagenes.guardar(exigirArchivo(req));
    res.status(201).json({ success: true, data: { imagen } });
  } catch (error) {
    next(error);
  }
};

const router = Router();

// Subida directa a Cloudinary: el navegador sube el archivo con esta firma,
// asi el secreto no sale del servidor ni los archivos pasan por el.
router.post('/firma/catalogo', protect, restrictTo('ADMIN'), firmarPara('catalogo'));
router.post('/firma/avatar', protect, firmarPara('avatares'));

// Alternativa cuando no hay Cloudinary configurado: el archivo se guarda en disco
router.post('/imagenes', protect, restrictTo('ADMIN'), recibirImagen, subirImagen);

export { router as uploadRoutes };
