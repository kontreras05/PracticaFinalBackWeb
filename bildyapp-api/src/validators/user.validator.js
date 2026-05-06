import { z } from 'zod';

/**
 * Esquema para el registro inicial de un usuario.
 * - email: Validado como formato email, pasado a minúsculas y sin espacios.
 * - password: Mínimo 8 caracteres obligatorios.
 */
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').transform((val) => val.toLowerCase().trim()),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
  })
});

/**
 * Esquema para la validación del código enviado por email.
 * - code: Debe tener exactamente 6 caracteres.
 */
export const validateAccountSchema = z.object({
  body: z.object({
    code: z.string().length(6, 'El código debe tener exactamente 6 dígitos')
  })
});

/**
 * Esquema para el inicio de sesión.
 */
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').transform((val) => val.toLowerCase().trim()),
    password: z.string().min(1, 'La contraseña es obligatoria')
  })
});

/**
 * Esquema para completar los datos personales del usuario (Onboarding Fase 1).
 */
export const onboardingPersonalSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'El nombre es obligatorio').trim(),
    lastName: z.string().min(1, 'Los apellidos son obligatorios').trim(),
    nif: z.string().min(1, 'El NIF es obligatorio').trim()
  })
});

/**
 * Esquema para registrar los datos de la compañía (Onboarding Fase 2).
 * Utiliza discriminatedUnion para validar de forma condicional:
 * - Si isFreelance es FALSE: Valida todos los datos de la empresa (nombre, cif, dirección).
 * - Si isFreelance es TRUE: No requiere datos adicionales ya que se usarán los del usuario.
 */
export const onboardingCompanySchema = z.object({
  body: z.discriminatedUnion('isFreelance', [
    z.object({
      isFreelance: z.literal(false),
      name: z.string().min(1, 'El nombre de la empresa es obligatorio').trim(),
      cif: z.string().min(1, 'El CIF es obligatorio').trim(),
      address: z.object({
        street: z.string().min(1, 'La calle es obligatoria').trim(),
        number: z.string().min(1, 'El número es obligatorio').trim(),
        postal: z.string().min(1, 'El código postal es obligatorio').trim(),
        city: z.string().min(1, 'La ciudad es obligatoria').trim(),
        province: z.string().min(1, 'La provincia es obligatoria').trim()
      })
    }),
    z.object({
      isFreelance: z.literal(true)
    })
  ])
});

/**
 * Esquema para el cambio de contraseña.
 * Incluye una validación cruzada (.refine) para asegurar que la nueva sea distinta a la actual.
 */
export const updatePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
    newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
  }).refine((data) => data.currentPassword !== data.newPassword, {
    message: 'La nueva contraseña debe ser diferente de la actual',
    path: ['newPassword']
  })
});

/**
 * Esquema para invitar a nuevos compañeros a la plataforma.
 */
export const inviteUserSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').transform((val) => val.toLowerCase().trim()),
    name: z.string().min(1, 'El nombre es obligatorio').trim(),
    lastName: z.string().min(1, 'Los apellidos son obligatorios').trim()
  })
});
