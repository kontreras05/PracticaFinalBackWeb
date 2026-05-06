/**
 * Importamos Zod para definir esquemas y validaciones de datos relacionados con Usuarios.
 */
import { z } from 'zod';

/**
 * Validación para el registro de nuevos usuarios.
 */
export const registerSchema = z.object({
  body: z.object({
    // Transforma el correo ingresado a minúsculas y quita espacios de los bordes automáticamente
    email: z.string().email('Email inválido').transform((val) => val.toLowerCase().trim()),
    // Exige que la contraseña tenga una seguridad mínima de longitud
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  }),
});

/**
 * Validación para confirmar y validar la cuenta por código.
 */
export const validateAccountSchema = z.object({
  body: z.object({
    // El código de confirmación tiene que ser exacto a 6 caracteres
    code: z.string().length(6, 'El código debe tener exactamente 6 dígitos'),
  }),
});

/**
 * Validación para inicio de sesión.
 */
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').transform((val) => val.toLowerCase().trim()),
    // Al loguearse no exigimos un .min(8) para evitar decirle al usuario por qué falla el login
    // Solamente exigimos que envíe 'algo'.
    password: z.string().min(1, 'La contraseña es obligatoria'),
  }),
});

/**
 * Validación para el Onboarding Personal (cuando el usuario rellena sus datos tras registrarse).
 */
export const onboardingPersonalSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'El nombre es obligatorio').trim(),
    lastName: z.string().min(1, 'Los apellidos son obligatorios').trim(),
    nif: z.string().min(1, 'El NIF es obligatorio').trim(),
  }),
});

/**
 * Validación para el Onboarding Empresarial.
 * Usa discriminatedUnion para aplicar una regla u otra según el valor de 'isFreelance'.
 */
export const onboardingCompanySchema = z.object({
  body: z.discriminatedUnion('isFreelance', [
    // Opción A: isFreelance es FALSO (por tanto, sí crea/asocia una empresa real con todos sus datos)
    z.object({
      isFreelance: z.literal(false),
      name: z.string().min(1, 'El nombre de la empresa es obligatorio').trim(),
      cif: z.string().min(1, 'El CIF es obligatorio').trim(),
      address: z.object({
        street: z.string().min(1, 'La calle es obligatoria').trim(),
        number: z.string().min(1, 'El número es obligatorio').trim(),
        postal: z.string().min(1, 'El código postal es obligatorio').trim(),
        city: z.string().min(1, 'La ciudad es obligatoria').trim(),
        province: z.string().min(1, 'La provincia es obligatoria').trim(),
      }),
    }),
    // Opción B: isFreelance es VERDADERO (es autónomo, por lo tanto no requiere llenar datos de empresa extra)
    z.object({ isFreelance: z.literal(true) }),
  ]),
});

/**
 * Validación para la actualización de la contraseña (cambiar password).
 */
export const updatePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
      newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
    })
    // .refine() añade lógica compleja, en este caso asegura que no esté cambiando la contraseña a la misma que ya tenía
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: 'La nueva contraseña debe ser diferente de la actual',
      // 'path' dice a qué campo echarle la culpa en caso de fallo, para que en el front muestre el error en 'newPassword'
      path: ['newPassword'],
    }),
});

/**
 * Validación para invitar a otro usuario a unirse al equipo de la empresa.
 */
export const inviteUserSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').transform((val) => val.toLowerCase().trim()),
    name: z.string().min(1, 'El nombre es obligatorio').trim(),
    lastName: z.string().min(1, 'Los apellidos son obligatorios').trim(),
  }),
});

/**
 * Exportamos los tipos extraídos automáticamente por Zod.
 */
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type OnboardingPersonalInput = z.infer<typeof onboardingPersonalSchema>['body'];
export type InviteUserInput = z.infer<typeof inviteUserSchema>['body'];
