import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, UtensilsCrossed } from "lucide-react";

export interface DietaryRestriction {
  type: 'vegetarian' | 'vegan' | 'gluten_free' | 'dairy_free' | 'nut_allergy' | 'shellfish_allergy' | 'other';
  description?: string;
  severity: 'preference' | 'allergy' | 'religious';
}

export interface PlusOneDietary {
  name: string;
  restrictions: DietaryRestriction[];
}

interface DietaryRestrictionsFormProps {
  hasPlusOne: boolean;
  onRestrictionsChange: (restrictions: DietaryRestriction[], plusOne?: PlusOneDietary) => void;
  restrictions: DietaryRestriction[];
  plusOneRestrictions?: PlusOneDietary;
}

const dietaryOptions = [
  { id: 'vegetarian', label: 'Vegetariano', icon: '🥗', severity: 'preference' as const },
  { id: 'vegan', label: 'Vegano', icon: '🌱', severity: 'preference' as const },
  { id: 'gluten_free', label: 'Sin gluten (Celíaco)', icon: '🌾', severity: 'allergy' as const },
  { id: 'dairy_free', label: 'Sin lácteos', icon: '🥛', severity: 'preference' as const },
  { id: 'nut_allergy', label: 'Alergia a nueces', icon: '🥜', severity: 'allergy' as const },
  { id: 'shellfish_allergy', label: 'Alergia a mariscos', icon: '🦐', severity: 'allergy' as const },
  { id: 'other', label: 'Otra', icon: '📝', severity: 'preference' as const },
];

export function DietaryRestrictionsForm({
  hasPlusOne,
  onRestrictionsChange,
  restrictions,
  plusOneRestrictions,
}: DietaryRestrictionsFormProps) {
  const [selectedRestrictions, setSelectedRestrictions] = useState<Set<string>>(
    new Set(restrictions.map(r => r.type))
  );
  const [otherDescription, setOtherDescription] = useState(
    restrictions.find(r => r.type === 'other')?.description || ''
  );

  const [plusOneHasRestrictions, setPlusOneHasRestrictions] = useState(
    !!plusOneRestrictions?.restrictions.length
  );
  const [plusOneName, setPlusOneName] = useState(plusOneRestrictions?.name || '');
  const [plusOneSelected, setPlusOneSelected] = useState<Set<string>>(
    new Set(plusOneRestrictions?.restrictions.map(r => r.type) || [])
  );
  const [plusOneOtherDescription, setPlusOneOtherDescription] = useState(
    plusOneRestrictions?.restrictions.find(r => r.type === 'other')?.description || ''
  );

  const handleRestrictionToggle = (restrictionId: string, isChecked: boolean) => {
    const newSelected = new Set(selectedRestrictions);
    if (isChecked) {
      newSelected.add(restrictionId);
    } else {
      newSelected.delete(restrictionId);
      if (restrictionId === 'other') {
        setOtherDescription('');
      }
    }
    setSelectedRestrictions(newSelected);
    updateParent(newSelected, otherDescription, plusOneHasRestrictions, plusOneName, plusOneSelected, plusOneOtherDescription);
  };

  const handleOtherDescriptionChange = (value: string) => {
    setOtherDescription(value);
    updateParent(selectedRestrictions, value, plusOneHasRestrictions, plusOneName, plusOneSelected, plusOneOtherDescription);
  };

  const handlePlusOneToggle = (restrictionId: string, isChecked: boolean) => {
    const newSelected = new Set(plusOneSelected);
    if (isChecked) {
      newSelected.add(restrictionId);
    } else {
      newSelected.delete(restrictionId);
      if (restrictionId === 'other') {
        setPlusOneOtherDescription('');
      }
    }
    setPlusOneSelected(newSelected);
    updateParent(selectedRestrictions, otherDescription, plusOneHasRestrictions, plusOneName, newSelected, plusOneOtherDescription);
  };

  const handlePlusOneOtherDescriptionChange = (value: string) => {
    setPlusOneOtherDescription(value);
    updateParent(selectedRestrictions, otherDescription, plusOneHasRestrictions, plusOneName, plusOneSelected, value);
  };

  const updateParent = (
    selected: Set<string>,
    other: string,
    hasPlusOneRestrictions: boolean,
    plusOneName: string,
    plusOneRestrictionSet: Set<string>,
    plusOneOther: string
  ) => {
    // Build main restrictions
    const mainRestrictions: DietaryRestriction[] = Array.from(selected).map(type => {
      const option = dietaryOptions.find(o => o.id === type);
      return {
        type: type as any,
        description: type === 'other' ? other : undefined,
        severity: option?.severity || 'preference',
      };
    });

    // Build plus one restrictions if applicable
    let plusOneData: PlusOneDietary | undefined;
    if (hasPlusOne && hasPlusOneRestrictions && plusOneName.trim()) {
      plusOneData = {
        name: plusOneName,
        restrictions: Array.from(plusOneRestrictionSet).map(type => {
          const option = dietaryOptions.find(o => o.id === type);
          return {
            type: type as any,
            description: type === 'other' ? plusOneOther : undefined,
            severity: option?.severity || 'preference',
          };
        }),
      };
    }

    onRestrictionsChange(mainRestrictions, plusOneData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <UtensilsCrossed className="h-5 w-5" />
          Restricciones Alimentarias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main participant restrictions */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecciona todas las que apliquen a ti:
          </p>

          <div className="grid gap-3">
            {dietaryOptions.map((option) => (
              <div key={option.id} className="flex items-start space-x-3">
                <Checkbox
                  id={option.id}
                  checked={selectedRestrictions.has(option.id)}
                  onCheckedChange={(checked) => handleRestrictionToggle(option.id, checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none flex-1">
                  <Label
                    htmlFor={option.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                  >
                    <span>{option.icon}</span>
                    {option.label}
                    {option.severity === 'allergy' && (
                      <AlertCircle className="h-4 w-4 text-destructive ml-1" />
                    )}
                  </Label>
                </div>
              </div>
            ))}
          </div>

          {selectedRestrictions.has('other') && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="other-description">Describe la restricción:</Label>
              <Textarea
                id="other-description"
                placeholder="Ej: Alergia al pescado, dieta baja en sodio, etc."
                value={otherDescription}
                onChange={(e) => handleOtherDescriptionChange(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>
          )}
        </div>

        {/* Plus one restrictions */}
        {hasPlusOne && (
          <>
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-3">
                ¿Tu acompañante tiene restricciones alimentarias?
              </p>
              <RadioGroup
                value={plusOneHasRestrictions ? 'yes' : 'no'}
                onValueChange={(value) => {
                  const hasRestrictions = value === 'yes';
                  setPlusOneHasRestrictions(hasRestrictions);
                  updateParent(selectedRestrictions, otherDescription, hasRestrictions, plusOneName, plusOneSelected, plusOneOtherDescription);
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="plusone-no" />
                  <Label htmlFor="plusone-no">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="plusone-yes" />
                  <Label htmlFor="plusone-yes">Sí</Label>
                </div>
              </RadioGroup>
            </div>

            {plusOneHasRestrictions && (
              <div className="space-y-4 ml-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="plusone-name">Nombre del acompañante:</Label>
                  <Input
                    id="plusone-name"
                    placeholder="Nombre completo"
                    value={plusOneName}
                    onChange={(e) => {
                      setPlusOneName(e.target.value);
                      updateParent(selectedRestrictions, otherDescription, plusOneHasRestrictions, e.target.value, plusOneSelected, plusOneOtherDescription);
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Restricciones del acompañante:</Label>
                  {dietaryOptions.map((option) => (
                    <div key={`plusone-${option.id}`} className="flex items-start space-x-3">
                      <Checkbox
                        id={`plusone-${option.id}`}
                        checked={plusOneSelected.has(option.id)}
                        onCheckedChange={(checked) => handlePlusOneToggle(option.id, checked as boolean)}
                      />
                      <div className="grid gap-1.5 leading-none flex-1">
                        <Label
                          htmlFor={`plusone-${option.id}`}
                          className="text-sm font-medium leading-none flex items-center gap-2"
                        >
                          <span>{option.icon}</span>
                          {option.label}
                          {option.severity === 'allergy' && (
                            <AlertCircle className="h-4 w-4 text-destructive ml-1" />
                          )}
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>

                {plusOneSelected.has('other') && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="plusone-other-description">Describe la restricción:</Label>
                    <Textarea
                      id="plusone-other-description"
                      placeholder="Ej: Alergia al pescado, dieta baja en sodio, etc."
                      value={plusOneOtherDescription}
                      onChange={(e) => handlePlusOneOtherDescriptionChange(e.target.value)}
                      className="resize-none"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            💡 Esta información se compartirá con todos los participantes de tu cena
            para asegurar comida segura para todos.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
