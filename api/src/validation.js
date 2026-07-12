import { z } from "zod";

// --- Form Validation Schemas ---

export const formFieldSchema = z.object({
    id: z.string().min(1),
    type: z.enum([
        "text", "textarea", "email", "tel", "number", "date", "time",
        "select", "checkbox", "radio", "checkbox_group", "file",
        "description", "image", "success_link", "scale", "section_break"
    ]),
    label: z.string().optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    options: z.array(
        z.string().or(
            z.object({
                label: z.string(),
                value: z.string(),
                goto: z.string().optional()
            })
        )
    ).optional(), // For select/radio/checkbox_group
    linkUrl: z.string().optional(), // For success_link
    linkApp: z.string().optional(), // For success_link app choice
    mediaUrl: z.string().optional(), // For image
    scaleMin: z.number().optional(), // For scale min limit
    scaleLimit: z.number().optional(), // For scale max limit
    scaleBranching: z.record(z.string()).optional(), // For scale branching rules
    goto: z.string().optional(), // For section_break routing
    validation: z.object({
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().optional(),
    }).optional(),
});

export const formDesignSchema = z.object({
    themeColor: z.string().optional(),
    banner: z.string().url().nullable().or(z.literal("")).optional().transform(val => val || null),
    logoLight: z.string().url().nullable().or(z.literal("")).optional().transform(val => val || null),
    logoDark: z.string().url().nullable().or(z.literal("")).optional().transform(val => val || null),
    allowMultipleResponses: z.boolean().optional(),
    webTitle: z.string().optional(),
    cloudinary: z.object({
        cloudName: z.string().optional().or(z.literal("")),
        preset: z.string().optional().or(z.literal("")),
    }).optional(),
    formTitle: z.string().optional(),
    formDescription: z.string().optional(),
    section1Goto: z.string().optional(),
    responseLimit: z.preprocess((val) => (val ? parseInt(val, 10) : undefined), z.number().optional()),
});

export const saveFormSchema = z.object({
    title: z.string().optional(), // Defaults to "Untitled Form" in backend
    description: z.string().optional(),
    fields: z.array(formFieldSchema).default([]),
    design: formDesignSchema.optional(),
    responseLimit: z.preprocess((val) => (val ? parseInt(val, 10) : undefined), z.number().optional()),
});

export const updateFormSchema = saveFormSchema.partial(); // Allow partial updates if needed, though usually we PUT full object

// --- Submission Validation ---

// Dynamic schema generator for form submissions
export function createSubmissionSchema(formConfig) {
    const shape = {};

    formConfig.forEach((field) => {
        // Skip display-only fields and section dividers
        if (field.type === "description" || field.type === "image" || field.type === "success_link" || field.type === "section_break") return;

        let schema;

        switch (field.type) {
            case "email":
                schema = z.string().email();
                break;
            case "number":
                schema = z.preprocess((val) => Number(val), z.number());
                break;
            case "scale":
                schema = z.preprocess((val) => Number(val), z.number());
                break;
            case "checkbox":
            case "checkbox_group":
                schema = z.array(z.string()).or(z.boolean()); // Checkbox can be array of values or boolean
                break;
            default:
                schema = z.string();
        }

        // Apply trims to strings
        if (field.type === "text" || field.type === "textarea") {
            schema = schema.trim();
        }

        if (field.required) {
            schema = schema.min(1, { message: `${field.label || field.id} is required` });
        } else {
            schema = schema.optional().or(z.literal(""));
        }

        shape[field.id] = schema;
    });

    return z.object(shape);
}

// --- Login Schema ---
// username is optional: omitting it = Super Admin flow (password-only)
// providing it = Sub-Admin flow (username + password)
export const loginSchema = z.object({
    password: z.string().min(1, "Password is required"),
    username: z.string().optional(),
});

// Schema for creating a new sub-admin user
export const createAdminUserSchema = z.object({
    username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(32, "Username must be 32 characters or fewer")
        .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters"),
});

/**
 * Validate data against a Zod schema.
 * Throws an error if validation fails.
 */
export async function validate(schema, data) {
    try {
        return await schema.parseAsync(data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            // Safely handle issues/errors array
            const issues = error.issues || error.errors || [];
            const messages = issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
            throw new Error(`Validation Error: ${messages}`);
        }
        throw error;
    }
}
