-- Update payslip_lines to include account_id for easier GL mapping
ALTER TABLE payslip_lines ADD COLUMN account_id UUID REFERENCES accounts(id);

-- Add component_id to link back if needed
ALTER TABLE payslip_lines ADD COLUMN component_id UUID REFERENCES payroll_components(id);
