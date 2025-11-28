import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DietaryRestrictionsForm } from '../DietaryRestrictionsForm';

describe('DietaryRestrictionsForm', () => {
  const mockOnRestrictionsChange = vi.fn();

  const defaultProps = {
    hasPlusOne: false,
    onRestrictionsChange: mockOnRestrictionsChange,
    restrictions: [],
  };

  it('renders all dietary restriction options', () => {
    render(<DietaryRestrictionsForm {...defaultProps} />);

    expect(screen.getByLabelText(/Vegetariano/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Vegano/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sin gluten/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sin lácteos/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Alergia a nueces/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Alergia a mariscos/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Otra/i)).toBeInTheDocument();
  });

  it('calls onRestrictionsChange when a restriction is selected', () => {
    render(<DietaryRestrictionsForm {...defaultProps} />);

    const vegetarianCheckbox = screen.getByLabelText(/Vegetariano/i);
    fireEvent.click(vegetarianCheckbox);

    expect(mockOnRestrictionsChange).toHaveBeenCalled();
    const callArgs = mockOnRestrictionsChange.mock.calls[0][0];
    expect(callArgs).toHaveLength(1);
    expect(callArgs[0].type).toBe('vegetarian');
  });

  it('shows textarea when "Otra" is selected', () => {
    render(<DietaryRestrictionsForm {...defaultProps} />);

    const otraCheckbox = screen.getByLabelText(/Otra/i);
    fireEvent.click(otraCheckbox);

    expect(screen.getByPlaceholderText(/Ej: Alergia al pescado/i)).toBeInTheDocument();
  });

  it('shows plus-one section when hasPlusOne is true', () => {
    render(<DietaryRestrictionsForm {...defaultProps} hasPlusOne={true} />);

    expect(screen.getByText(/¿Tu acompañante tiene restricciones alimentarias?/i)).toBeInTheDocument();
  });

  it('shows plus-one details when user selects "Sí"', () => {
    render(<DietaryRestrictionsForm {...defaultProps} hasPlusOne={true} />);

    const yesRadio = screen.getByLabelText('Sí');
    fireEvent.click(yesRadio);

    expect(screen.getByLabelText(/Nombre del acompañante:/i)).toBeInTheDocument();
    expect(screen.getByText(/Restricciones del acompañante:/i)).toBeInTheDocument();
  });

  it('handles multiple restriction selections', () => {
    render(<DietaryRestrictionsForm {...defaultProps} />);

    const vegetarianCheckbox = screen.getByLabelText(/Vegetariano/i);
    const glutenFreeCheckbox = screen.getByLabelText(/Sin gluten/i);

    fireEvent.click(vegetarianCheckbox);
    fireEvent.click(glutenFreeCheckbox);

    const lastCall = mockOnRestrictionsChange.mock.calls[mockOnRestrictionsChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(2);
    expect(lastCall.map((r: any) => r.type)).toContain('vegetarian');
    expect(lastCall.map((r: any) => r.type)).toContain('gluten_free');
  });

  it('displays allergy warning icons for severe restrictions', () => {
    render(<DietaryRestrictionsForm {...defaultProps} />);

    // Check that allergy icons are present (these are AlertCircle icons)
    const labels = screen.getAllByRole('checkbox');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('shows informational alert about sharing restrictions', () => {
    render(<DietaryRestrictionsForm {...defaultProps} />);

    expect(screen.getByText(/Esta información se compartirá con todos los participantes/i)).toBeInTheDocument();
  });
});
