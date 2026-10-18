import type { Form, Medicine } from './types.ts';

export type MedicineType = Form | 'insulin';

export const MEDICINE_TYPES: {
  value: MedicineType;
  label: string;
  form: Form;
}[] = [
  { value: 'tablet', label: 'Tablet', form: 'tablet' },
  { value: 'capsule', label: 'Capsule', form: 'capsule' },
  { value: 'liquid', label: 'Liquid', form: 'liquid' },
  { value: 'insulin', label: 'Insulin', form: 'injection' },
  { value: 'injection', label: 'Injection', form: 'injection' },
  { value: 'puff', label: 'Inhaler', form: 'puff' },
  { value: 'drops', label: 'Drops', form: 'drops' },
  { value: 'cream', label: 'Cream / gel', form: 'cream' },
  { value: 'patch', label: 'Patch', form: 'patch' },
];

export const FORM_FIELDS: Record<
  Form,
  {
    amountLabel: string;
    noun: string;
    strengthExample: string;
    stockUnit?: string;
    siteLabel?: string;
    siteExample?: string;
  }
> = {
  tablet: {
    amountLabel: 'Tablets per dose',
    noun: 'tablets',
    strengthExample: '500 mg',
    stockUnit: 'tablets',
  },
  capsule: {
    amountLabel: 'Capsules per dose',
    noun: 'capsules',
    strengthExample: '20 mg',
    stockUnit: 'capsules',
  },
  liquid: {
    amountLabel: 'Volume per dose',
    noun: 'ml',
    strengthExample: '250 mg / 5 ml',
    stockUnit: 'ml',
  },
  puff: {
    amountLabel: 'Puffs per dose',
    noun: 'puffs',
    strengthExample: '100 mcg / puff',
    stockUnit: 'puffs',
  },
  drops: {
    amountLabel: 'Drops per application',
    noun: 'drops',
    strengthExample: '0.5%',
    siteLabel: 'Where to use (optional)',
    siteExample: 'Both eyes, left eye, or right ear',
  },
  injection: {
    amountLabel: 'Amount per dose',
    noun: 'injections',
    strengthExample: '40 mg / 0.4 ml',
  },
  cream: {
    amountLabel: 'Amount to apply (optional)',
    noun: 'applications',
    strengthExample: '1%',
    siteLabel: 'Where to apply (optional)',
    siteExample: 'Affected area, or left arm',
  },
  patch: {
    amountLabel: 'Patches per change',
    noun: 'patches',
    strengthExample: '25 mcg / hour',
    stockUnit: 'patches',
    siteLabel: 'Application instructions (optional)',
    siteExample: 'Rotate the application site as prescribed',
  },
};

export function isInsulin(
  med: Pick<Medicine, 'form' | 'insulin' | 'doseUnit' | 'name'>,
) {
  // Recognise the insulin entries saved before the type was recorded explicitly.
  return (
    med.insulin ??
    (med.form === 'injection' &&
      med.doseUnit === 'units' &&
      /\b(insulin|apidra|lantus|humalog|novorapid|fiasp|tresiba|levemir|toujeo|novomix)\b/i.test(
        med.name,
      ))
  );
}

export function hasFoodTiming(form: Form) {
  return form === 'tablet' || form === 'capsule' || form === 'liquid';
}
