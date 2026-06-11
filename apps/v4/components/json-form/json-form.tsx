"use client";

import React, {
  useMemo,
  useState,
  createContext,
  JSX,
  useContext,
} from "react";

import {
  SubmitHandler,
  UseFormReturn,
  FieldError,
  appendErrors,
  FieldValues,
  ResolverOptions,
  ResolverResult,
  ControllerRenderProps,
} from "react-hook-form";

import set from "lodash/set";
import * as Ajv from "ajv";
import { DefinedError } from "ajv";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

import { Button } from "@/components/uiform/ui/button";
import { Input, InputProps } from "@/components/uiform/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/uiform/ui/form";
import { Checkbox } from "@/components/uiform/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/uiform/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/uiform/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/uiform/ui/tooltip";
import { Skeleton } from "@/components/uiform/ui/skeleton";
import { Calendar } from "@/components/uiform/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/uiform/ui/popover";

import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import {
  resolveDraftValue,
  resolveTimeInputValue,
} from "@/components/uiform/uiform-draft-state";

//@ts-ignore

import { JSONSchema7 as JSONSchema } from "json-schema";

import {
  Plus,
  Trash,
  TriangleAlert,
  Atom,
  Search,
  Info,
  Code,
  Gauge,
  CalendarIcon,
  Blend,
  Pencil,
  SquarePen,
  MessageSquareWarning,
} from "lucide-react";

import { isArray, isUndefined } from "lodash";
import { TooltipArrow } from "@radix-ui/react-tooltip";
import { Textarea } from "@/components/uiform/ui/textarea";

import {
  getColor,
  DISTANCES_COLORMAP,
  CONSENSUS_COLORMAP,
  CONSENSUS_INVERSE,
  DISTANCES_INVERSE,
  getMismatchColor,
} from "@/components/uiform/lib/colors";
import { autoFormatDateTimeFields } from "@/components/uiform/lib/date-utils";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/uiform/ui/dialog";
import { PropertyEditor } from "@/components/schema-editor/property-dialog";
import { Switch } from "@/components/uiform/ui/switch";
import { expandRefs } from "@/components/uiform/lib/expand-refs";

/*
--------------------------------
--------------------------------
--------------------------------
TYPES DEFINITIONS
--------------------------------
--------------------------------
--------------------------------
*/

export type ScalarValueVariant =
  | "none"
  | "underline-close"
  | "underline-distant"
  | "left-border-close"
  | "left-border-distant"
  | "blur-small"
  | "blur-large"
  | "blur-xlarge"
  | "outline-small"
  | "outline-large"
  | "outline-xlarge";

export type scalarValueType = "similarity" | "consensus" | "mismatch" | "none";

export type FileUploadVariant = "disabled" | "button" | "flow" | "preview";

export type AIProvider =
  | "OpenAI"
  | "xAI"
  | "Anthropic"
  | "Mistral"
  | "Google"
  | "Azure"
  | "AWS"
  | "Groq"
  | "Together";

// Sentinel values for Select components (Radix forbids empty string values)
const NULL_OPTION = "__none__";
const EMPTY_OPTION = "__empty__";

// Helper functions to map between model values and select values
const toSelectValue = (v: any): string => {
  if (v === null || v === undefined) return NULL_OPTION;
  if (v === "") return EMPTY_OPTION;
  const stringValue = String(v);
  return stringValue === "" ? EMPTY_OPTION : stringValue;
};

const fromSelectValue = (v: string): any => {
  if (v === NULL_OPTION) return null;
  if (v === EMPTY_OPTION) return "";
  return v;
};


export interface Document {
  document: {
    content: string; // Base64 encoded document
    mimeType: string; // mimeType of the document
  };
}

export interface ConfigProps {
  labelPrefix?: string;
  titles?: Record<string, boolean>;
  descriptions?: boolean;
  showPrompts?: boolean;
  showSources?: boolean;
  showErrors?: boolean;
  submitText?: string;
  groundTruthData?: Record<string, any>; // Ground truth data for displaying badges next to labels
  onGroundTruthChange?: (fieldPath: string, newValue: any) => void; // Callback when ground truth is edited
  onToggleMismatch?: (fieldPath: string) => void; // Callback to toggle a field in the mismatches list
  mismatches?: string[]; // List of field paths that are in the mismatches list
  readOnly?: boolean;
  showConfidenceTablets?: boolean;
  predictionData?: Record<string, any>;
}

export interface UiFormProps {
  showSubmit?: boolean;
  schema: JSONSchema; // JSON Schema. Contains: Types, descriptions, variables + prompts in the JSON Schema Extras
  setSchema?: (schema: JSONSchema) => void; // Optional setter for schema
  className?: string;
  onSubmit: SubmitHandler<Record<string, any>>;
  config?: ConfigProps;
  disabled?: boolean;
  variant: "normal" | "flow";
  size: "sm" | "lg";
  isStreaming: boolean;
  isProcessing: boolean;
  form: UseFormReturn<Record<string, any>, any, Record<string, any>>;
  scalarValueDisplay: ScalarValueVariant;
  scalarValueType: scalarValueType;
  likelihoods: Record<string, any>;
  setSourcesFieldPath?: (fieldPath: string | null) => void;
  titlePosition: TitlePosition;
  setLikelihoods: (likelihoods: Record<string, any>) => void;
  propertyEditorMode: "promptOnly" | "readOnly" | "editable";
  showPropertyEditorPencil: boolean;
  validationFlags: Record<string, any>;
  setValidationFlags: (validationFlags: Record<string, any>) => void;
  formFieldIdPrefix?: string;
  showVerifiedProperty?: boolean;
  projectId?: string;
}

interface UiFormContextValue extends UiFormProps {
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface StyledDatePickerProps {
  variant?: ScalarValueVariant;
  uncertainty?: number;
  value?: Date | null;
  onValueChange?: (value: Date | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  size: "sm" | "lg";
  scalarValueType: scalarValueType;
}

export const StyledDatePicker = React.forwardRef<
  HTMLButtonElement,
  StyledDatePickerProps
>(
  (
    {
      className,
      variant,
      uncertainty,
      value,
      onValueChange,
      disabled,
      placeholder = "Pick a date",
      size,
      scalarValueType,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const { setIsEditing } = useUiFormContext();

    return (
      <div
        className={(() => {
          switch (variant) {
            case "underline-close":
              return "border-b-2 pb-0";
            case "underline-distant":
              return "border-b-2 pb-2";
            case "left-border-close":
              return "border-l-4 pl-0";
            case "left-border-distant":
              return "border-l-4 pl-2";
            default:
              return "";
          }
        })()}
        style={(() => {
          switch (variant) {
            case "underline-close":
            case "underline-distant":
            case "left-border-close":
            case "left-border-distant":
              return {
                borderColor: getScalarValueColor(uncertainty, scalarValueType),
              };
            default:
              return {};
          }
        })()}
      >
        <Popover
          open={open}
          onOpenChange={(isOpen: boolean) => {
            setOpen(isOpen);
            setIsEditing(isOpen); // Set editing state when calendar is open
          }}
        >
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              variant="outline"
              disabled={disabled}
              className={cn(
                className,
                size === "sm" ? "h-[32px] text-sm" : "h-[42px] text-sm",
                "w-full justify-start text-left font-normal",
                !value && "text-muted-foreground",
              )}
              style={(() => {
                switch (variant) {
                  case "blur-small":
                    return {
                      boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 2px 1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                    };
                  case "blur-large":
                    return {
                      boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 4px 2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                    };
                  case "blur-xlarge":
                    return {
                      boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 6px 3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                    };
                  case "outline-small":
                    return {
                      boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                    };
                  case "outline-large":
                    return {
                      boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                    };
                  case "outline-xlarge":
                    return {
                      boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                    };
                  default:
                    return {};
                }
              })()}
            >
              {value && isValid(value) ? format(value, "PPP") : placeholder}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value && isValid(value) ? value : undefined}
              defaultMonth={value && isValid(value) ? value : undefined}
              onSelect={(date) => {
                onValueChange?.(date || null);
                setOpen(false);
                setIsEditing(false); // Reset editing state when selection is done
              }}
              captionLayout="dropdown"
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
StyledDatePicker.displayName = "StyledDatePicker";

export interface StyledTimePickerProps {
  variant?: ScalarValueVariant;
  uncertainty?: number;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  size: "sm" | "lg";
  scalarValueType: scalarValueType;
}

export const StyledTimePicker = React.forwardRef<
  HTMLInputElement,
  StyledTimePickerProps
>(
  (
    {
      className,
      variant,
      uncertainty,
      value,
      onValueChange,
      disabled,
      size,
      scalarValueType,
    },
    ref,
  ) => {
    const { setIsEditing } = useUiFormContext();
    return (
      <div
        className={(() => {
          switch (variant) {
            case "underline-close":
              return "border-b-2 pb-0";
            case "underline-distant":
              return "border-b-2 pb-2";
            case "left-border-close":
              return "border-l-4 pl-0";
            case "left-border-distant":
              return "border-l-4 pl-2";
            default:
              return "";
          }
        })()}
        style={(() => {
          switch (variant) {
            case "underline-close":
            case "underline-distant":
            case "left-border-close":
            case "left-border-distant":
              return {
                borderColor: getScalarValueColor(uncertainty, scalarValueType),
              };
            default:
              return {};
          }
        })()}
      >
        <Input
          ref={ref}
          type="time"
          disabled={disabled}
          value={value || ""}
          onClick={() => {
            setIsEditing(true);
          }}
          onChange={(e) => {
            setIsEditing(true);
            onValueChange?.(e.target.value);
          }}
          onBlur={() => {
            setIsEditing(false);
          }}
          className={cn(
            className,
            size === "sm" ? "h-[32px] text-sm" : "h-[42px] text-sm",
            "bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
          )}
          style={(() => {
            switch (variant) {
              case "blur-small":
                return {
                  boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 2px 1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                };
              case "blur-large":
                return {
                  boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 4px 2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                };
              case "blur-xlarge":
                return {
                  boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 6px 3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                };
              case "outline-small":
                return {
                  boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                };
              case "outline-large":
                return {
                  boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                };
              case "outline-xlarge":
                return {
                  boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                };
              default:
                return {};
            }
          })()}
        />
      </div>
    );
  },
);
StyledTimePicker.displayName = "StyledTimePicker";

export interface StyledDateTimePickerProps {
  variant?: ScalarValueVariant;
  uncertainty?: number;
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  size: "sm" | "lg";
  scalarValueType: scalarValueType;
}

export const StyledDateTimePicker = React.forwardRef<
  HTMLDivElement,
  StyledDateTimePickerProps
>(
  (
    {
      className,
      variant,
      uncertainty,
      value,
      onValueChange,
      disabled,
      size,
      scalarValueType,
    },
    ref,
  ) => {
    // Parse the datetime-local value into date and time components
    const dateTimeValue = safeDate(value);
    const dateValue =
      dateTimeValue && isValid(dateTimeValue)
        ? new Date(
            dateTimeValue.getFullYear(),
            dateTimeValue.getMonth(),
            dateTimeValue.getDate(),
          )
        : null;
    const timeValue =
      dateTimeValue && isValid(dateTimeValue)
        ? `${dateTimeValue.getHours().toString().padStart(2, "0")}:${dateTimeValue.getMinutes().toString().padStart(2, "0")}`
        : "";

    // Local state for time input - follows the "local changes + persist on blur" pattern
    const [localTimeValue, setLocalTimeValue] = React.useState(timeValue);
    const [isEditingTime, setIsEditingTime] = React.useState(false);
    const displayedTimeValue = resolveTimeInputValue(
      timeValue,
      localTimeValue,
      isEditingTime,
    );

    const handleDateChange = (date: Date | null) => {
      if (!date) {
        onValueChange?.(null);
        return;
      }

      const currentTime = timeValue || "00:00:00";
      const [hours, minutes, seconds] = currentTime.split(":").map(Number);

      const newDateTime = new Date(date);
      newDateTime.setHours(hours, minutes, seconds || 0);

      // Format as datetime-local string
      const year = newDateTime.getFullYear();
      const month = (newDateTime.getMonth() + 1).toString().padStart(2, "0");
      const day = newDateTime.getDate().toString().padStart(2, "0");
      const hour = newDateTime.getHours().toString().padStart(2, "0");
      const minute = newDateTime.getMinutes().toString().padStart(2, "0");
      const second = newDateTime.getSeconds().toString().padStart(2, "0");

      onValueChange?.(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    };

    const handleTimeChange = (time: string) => {
      if (!dateValue && !time) {
        onValueChange?.(null);
        return;
      }

      const date = dateValue || new Date();
      const [hours, minutes, seconds] = time.split(":").map(Number);

      const newDateTime = new Date(date);
      newDateTime.setHours(hours, minutes, seconds || 0);

      // Format as datetime-local string
      const year = newDateTime.getFullYear();
      const month = (newDateTime.getMonth() + 1).toString().padStart(2, "0");
      const day = newDateTime.getDate().toString().padStart(2, "0");
      const hour = newDateTime.getHours().toString().padStart(2, "0");
      const minute = newDateTime.getMinutes().toString().padStart(2, "0");
      const second = newDateTime.getSeconds().toString().padStart(2, "0");

      onValueChange?.(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    };

    return (
      <div ref={ref} className="flex gap-2">
        <StyledDatePicker
          variant={variant}
          uncertainty={uncertainty}
          value={dateValue}
          onValueChange={handleDateChange}
          disabled={disabled}
          className={className}
          size={size}
          placeholder="Select date"
          scalarValueType={scalarValueType}
        />
        <div
          className={(() => {
            switch (variant) {
              case "underline-close":
                return "border-b-2 pb-0";
              case "underline-distant":
                return "border-b-2 pb-2";
              case "left-border-close":
                return "border-l-4 pl-0";
              case "left-border-distant":
                return "border-l-4 pl-2";
              default:
                return "";
            }
          })()}
          style={(() => {
            switch (variant) {
              case "underline-close":
              case "underline-distant":
              case "left-border-close":
              case "left-border-distant":
                return {
                  borderColor: getScalarValueColor(
                    uncertainty,
                    scalarValueType,
                  ),
                };
              default:
                return {};
            }
          })()}
        >
          <StyledInput
            type="time"
            disabled={disabled}
            value={displayedTimeValue || ""}
            onFocus={() => {
              setLocalTimeValue(timeValue);
              setIsEditingTime(true);
            }}
            onChange={(e) => {
              // Only update local state, don't persist yet
              setLocalTimeValue(e.target.value);
            }}
            onBlur={(e) => {
              let finalValue = localTimeValue;
              // On blur, append seconds if missing for time inputs
              if (e.target.value && /^\d{1,2}:\d{2}$/.test(e.target.value)) {
                finalValue = e.target.value + ":00";
                setLocalTimeValue(finalValue);
              }
              // Now persist the change
              handleTimeChange(finalValue);
              setIsEditingTime(false);
            }}
            className={cn(
              className,
              size === "sm" ? "h-[32px] text-sm" : "h-[42px] text-sm",
              "bg-background",
            )}
            style={(() => {
              switch (variant) {
                case "blur-small":
                  return {
                    boxShadow: `0 0 2px 1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "blur-large":
                  return {
                    boxShadow: `0 0 4px 2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "blur-xlarge":
                  return {
                    boxShadow: `0 0 6px 3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-small":
                  return {
                    boxShadow: `0 0 0 1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-large":
                  return {
                    boxShadow: `0 0 0 2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-xlarge":
                  return {
                    boxShadow: `0 0 0 3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                default:
                  return {};
              }
            })()}
            variant={variant}
            uncertainty={uncertainty}
            scalarValueType={scalarValueType}
          />
        </div>
      </div>
    );
  },
);
StyledDateTimePicker.displayName = "StyledDateTimePicker";

/*
--------------------------------
--------------------------------
--------------------------------
REACT HOOK FORM
--------------------------------
--------------------------------
--------------------------------
*/

type Resolver = <T>(
  schema: Ajv.JSONSchemaType<T>,
  schemaOptions?: Ajv.Options,
  factoryOptions?: { mode?: "async" | "sync" },
) => <TFieldValues extends FieldValues, TContext>(
  values: TFieldValues,
  context: TContext | undefined,
  options: ResolverOptions<TFieldValues>,
) => Promise<ResolverResult<TFieldValues>>;

const _parseErrorSchema = (
  ajvErrors: DefinedError[],
  validateAllFieldCriteria: boolean,
) => {
  validateAllFieldCriteria = true;
  // Ajv will return empty instancePath when require error
  ajvErrors.forEach((error) => {
    if (error.keyword === "required") {
      error.instancePath += "/" + error.params.missingProperty;
    }
  });

  const errorsModified = ajvErrors.reduce<Record<string, FieldError>>(
    (previous, error) => {
      // `/deepObject/data` -> `deepObject.data`
      const path = error.instancePath.substring(1).replace(/\//g, ".");

      if (!previous[path]) {
        previous[path] = {
          message: error.message,
          type: error.keyword,
        };
      }

      if (validateAllFieldCriteria) {
        const types = previous[path].types;
        const messages = types && types[error.keyword];

        previous[path] = appendErrors(
          path,
          validateAllFieldCriteria,
          previous,
          error.keyword,
          messages
            ? ([] as string[]).concat(messages as string[], error.message || "")
            : error.message,
        ) as FieldError;
      }

      return previous;
    },
    {},
  );
  return errorsModified;
};

export const ajvResolver: Resolver =
  (schema, schemaOptions, _resolverOptions = {}) =>
  async (values, _, _options) => {
    // CLIENT-SIDE VALIDATION DISABLED - Always return success
    // To restore validation, uncomment the code below and comment out this return statement

    return { values, errors: {} };

    /*
                    const ajv = new Ajv.Ajv(
                        Object.assign(
                            {},
                            {
                                allErrors: true,
                                validateSchema: true,
                                coerceTypes: false, // Change this to false to prevent coercion
                                allowUnionTypes: true,
                                strict: false, // Add this to be less strict about types
                                strictRequired: false, // Add this to be less strict about required fields
                            },
                            schemaOptions,
                        ),
                    );
                    addFormats(ajv)
                    ajvErrors(ajv);
                    ajv.addKeyword("X-InferenceOnly")
                    ajv.addFormat("currency", {
                        type: "string",
                        validate: (x) => true,
                    });
                    ajv.addFormat("vat-number", {
                        type: "string",
                        validate: (x) => true,
                    });
                    ajv.addFormat("phone-number", {
                        type: "string",
                        validate: (x) => true,
                    });
                    ajv.addFormat("country-code", {
                        type: "string",
                        validate: (x) => true,
                    });
                    ajv.addFormat("iso-time", {
                        type: "string",
                        validate: (x) => {
                            // Accept empty string (for optional fields)
                            if (!x) return true;
                            // Accept partial time input (HH:MM) or complete time (HH:MM:SS)
                            return /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(x) ||
                                // Also accept incomplete time during typing
                                /^([0-2])?[0-9]?(:[0-5]?[0-9]?)?$/.test(x);
                        },
                    });
        
                    // Add custom format validator for email that accepts null
                    ajv.addFormat("email", {
                        type: "string",
                        validate: (x: any) => {
                            // Accept null values for optional fields
                            if (x === null || x === undefined) return true;
                            // Handle empty strings
                            if (x === "") return true;
                            // Validate non-empty strings with email regex
                            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
                        },
                    });
        
                    // Override the default date-time format to accept datetime-local format without timezone
                    ajv.addFormat("date-time", {
                        type: "string",
                        validate: (x: any) => {
                            // Accept null or undefined for optional fields
                            if (x === null || x === undefined) return true;
                            // Accept empty strings
                            if (x === "") return true;
                            // Accept datetime-local format (YYYY-MM-DDTHH:MM:SS) without timezone
                            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(x)) return true;
                            // Accept datetime-local format (YYYY-MM-DDTHH:MM) without seconds and timezone
                            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x)) return true;
                            // Accept standard RFC 3339 format with timezone
                            return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2}|Z)$/.test(x);
                        },
                    });
        
                    const validate = ajv.compile(
                        Object.assign(
                            { $async: resolverOptions && resolverOptions.mode === 'async' },
                            schema,
                        ),
                    );
        
                    const valid = validate(values);
        
                    options.shouldUseNativeValidation && validateFieldsNatively({}, options);
        
                    return valid
                        ? { values, errors: {} }
                        : {
                            values: {},
                            errors: toNestErrors(
                                parseErrorSchema(
                                    validate.errors as DefinedError[],
                                    !options.shouldUseNativeValidation &&
                                    options.criteriaMode === 'all',
                                ),
                                options,
                            ),
                        };
                    */
  };

export function mergeDescriptions(
  outerSchema: Record<string, any>,
  innerSchema: Record<string, any>,
): Record<string, any> {
  // Create deep copy of inner schema
  const merged = JSON.parse(JSON.stringify(innerSchema));

  // Outer description preferred if present
  if ("description" in outerSchema) {
    merged["description"] = outerSchema["description"];
  }

  // Add this: Merge X-EnumTranslation
  if ("X-EnumTranslation" in outerSchema) {
    merged["X-EnumTranslation"] = outerSchema["X-EnumTranslation"];
  } else if ("X-EnumTranslation" in innerSchema) {
    merged["X-EnumTranslation"] = innerSchema["X-EnumTranslation"];
  }

  // Add this: Merge X-FieldTranslation
  if ("X-FieldTranslation" in outerSchema) {
    merged["X-FieldTranslation"] = outerSchema["X-FieldTranslation"];
  } else if ("X-FieldTranslation" in innerSchema) {
    merged["X-FieldTranslation"] = innerSchema["X-FieldTranslation"];
  }

  return merged;
}

// --- NEW: normalize/unwrap helper for refs & nullable unions ----
const unwrapSchema = (node: any, root: any) => {
  let s = node;

  const deref = (n: any) => {
    if (n && n.$ref) {
      const refName = String(n.$ref).replace("#/$defs/", "");
      const target = root?.$defs?.[refName];
      if (target) {
        const merged = mergeDescriptions(n, target);
        const copy = { ...merged };
        delete (copy as any).$ref;
        return copy;
      }
    }
    return n;
  };

  s = deref(s);
  let nullable = false;

  // type: ['object','null'] (or array/null)
  if (Array.isArray(s?.type)) {
    if (s.type.includes("null")) {
      nullable = true;
      s = { ...s, type: s.type.find((t: string) => t !== "null") };
    }
  }

  // anyOf/oneOf/allOf with null
  const combos = s?.anyOf || s?.oneOf || s?.allOf;
  if (combos) {
    if (combos.some((o: any) => o?.type === "null")) nullable = true;
    const nonNull = combos.find(
      (o: any) =>
        (o?.type && o.type !== "null") ||
        o?.properties ||
        o?.items ||
        o?.$ref ||
        o?.enum,
    );
    if (nonNull) {
      s = deref(nonNull);
      s = expandRefs(s, root?.$defs ?? {});
    }
  }

  return { schema: s, nullable };
};

export const getScalarValueColor = (
  value: number | undefined,
  scalarValueType: scalarValueType,
): string => {
  if (value === undefined) return "transparent";
  if (scalarValueType === "none") return "transparent";

  // Use special handling for mismatch mode (transparent for 0, amber for 1)
  if (scalarValueType === "mismatch") {
    return getMismatchColor(value);
  }

  // Choose colormap based on scalarValueType
  const colormap =
    scalarValueType === "similarity" ? DISTANCES_COLORMAP : CONSENSUS_COLORMAP;

  const inverse =
    scalarValueType === "similarity" ? DISTANCES_INVERSE : CONSENSUS_INVERSE;

  return getColor(colormap, value, inverse, 0.3);
};

// Centralized helper to apply highlight styles for verified fields
const highlightClasses = (
  isVerified: boolean,
  _isComputedField: boolean,
  style: "ring" | "border" = "border",
  _isBoolean: boolean = false,
  _fieldValue?: any,
) => {
  if (style === "ring") {
    return cn(
      isVerified &&
        "bg-success/10 ring-success ring-2 data-[state=checked]:!bg-success/20 data-[state=checked]:!border-success data-[state=checked]:!text-success-foreground",
    );
  }
  return cn(
    isVerified &&
      "bg-success/10 border border-success data-[state=checked]:!bg-success/20 data-[state=checked]:!border-success data-[state=checked]:!text-success-foreground",
  );
};

// Match data-cell function field color coding
const getFunctionFieldStyling = (value: any): string => {
  if (value === true)
    return "border-success border bg-success/10 data-[state=checked]:!bg-success/20 data-[state=checked]:!border-success data-[state=checked]:!text-success-foreground";
  if (value === false)
    return "border-destructive border bg-destructive/10 data-[state=checked]:!bg-destructive/20 data-[state=checked]:!border-destructive data-[state=checked]:!text-destructive";
  if (value === null || value === undefined)
    return "border-warning border bg-warning/10 data-[state=checked]:!bg-warning/20 data-[state=checked]:!border-warning data-[state=checked]:!text-warning-foreground";
  return "border-success border bg-success/10 data-[state=checked]:!bg-success/20 data-[state=checked]:!border-success data-[state=checked]:!text-success-foreground";
};

export interface StyledInputProps extends InputProps {
  variant?: ScalarValueVariant;
  uncertainty?: number;
  multiline?: boolean;
  scalarValueType: scalarValueType;
}

export interface StyledInputProps extends InputProps {
  variant?: ScalarValueVariant;
  uncertainty?: number;
  multiline?: boolean;
  scalarValueType: scalarValueType;
}

export const StyledInput = React.forwardRef<HTMLInputElement, StyledInputProps>(
  (
    {
      className,
      variant,
      size: _size,
      type,
      uncertainty,
      multiline,
      scalarValueType,
      ...props
    },
    ref,
  ) => {
    const { setIsEditing } = useUiFormContext();

    // Intercept onKeyDown event to call onBlur if the key is Enter or Escape
    // This is overriding the onKeyDown event, so we need to call the original onKeyDown event
    const originalOnKeyDown = props.onKeyDown;
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // TODO: Is it wise to validate the value even on escape?
      // Or should we restore the original value ? (like an UNDO behavior?)
      if (e.key === "Enter" || e.key === "Escape") {
        e.currentTarget.blur();
      } else {
        originalOnKeyDown?.(e);
      }
    };
    props.onKeyDown = handleKeyDown;

    // Enhanced click and blur handlers using context
    const originalOnClick = props.onClick;
    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      setIsEditing(true);
      originalOnClick?.(e);
    };

    const originalOnBlur = props.onBlur;
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsEditing(false);
      originalOnBlur?.(e);
    };

    props.onClick = handleClick;
    props.onBlur = handleBlur;

    return (
      <div
        className={(() => {
          switch (variant) {
            case "underline-close":
              return "border-b-2 pb-0";
            case "underline-distant":
              return "border-b-2 pb-2";
            case "left-border-close":
              return "border-l-4 pl-0";
            case "left-border-distant":
              return "border-l-4 pl-2";
            default:
              return "";
          }
        })()}
        style={(() => {
          switch (variant) {
            case "underline-close":
            case "underline-distant":
            case "left-border-close":
            case "left-border-distant":
              return {
                borderColor: getScalarValueColor(uncertainty, scalarValueType),
              };
            default:
              return {};
          }
        })()}
      >
        {multiline ? (
          // @ts-ignore
          <Textarea
            rows={3}
            className={cn(className, "text-opacity-90")}
            ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
            {...props}
            style={(() => {
              switch (variant) {
                case "blur-small":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 2px  1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "blur-large":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 4px  2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "blur-xlarge":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 6px  3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-small":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-large":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-xlarge":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                default:
                  return {};
              }
            })()}
          />
        ) : (
          <Input
            type={type}
            className={cn(className, "text-opacity-90")}
            ref={ref}
            {...props}
            style={(() => {
              switch (variant) {
                case "blur-small":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 2px  1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "blur-large":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 4px  2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "blur-xlarge":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 6px  3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-small":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-large":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-xlarge":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                default:
                  return {};
              }
            })()}
          />
        )}
      </div>
    );
  },
);
StyledInput.displayName = "StyledInput";

export interface StyledTextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: ScalarValueVariant;
  uncertainty?: number;
  scalarValueType: scalarValueType;
}

export const StyledTextAreaInput = React.forwardRef<
  HTMLTextAreaElement,
  StyledTextAreaProps
>(
  (
    {
      className,
      variant,
      uncertainty,
      scalarValueType,
      value,
      onChange,
      ...props
    },
    _ref,
  ) => {
    const { setIsEditing } = useUiFormContext();
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    // Intercept onKeyDown event to call onBlur if the key is Enter or Escape
    const originalOnKeyDown = props.onKeyDown;
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        e.currentTarget.blur();
      } else {
        originalOnKeyDown?.(e);
      }
    };
    props.onKeyDown = handleKeyDown;

    // Enhanced click and blur handlers using context
    const originalOnClick = props.onClick;
    const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
      setIsEditing(true);
      originalOnClick?.(e);
    };

    const originalOnBlur = props.onBlur;
    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsEditing(false);
      originalOnBlur?.(e);
    };

    props.onClick = handleClick;
    props.onBlur = handleBlur;

    return (
      <div
        className={cn(
          (() => {
            switch (variant) {
              case "underline-close":
                return "border-b-2 pb-0";
              case "underline-distant":
                return "border-b-2 pb-2";
              case "left-border-close":
                return "border-l-4 pl-0";
              case "left-border-distant":
                return "border-l-4 pl-2";
              default:
                return "";
            }
          })(),
          "flex min-h-0 flex-1",
        )}
        style={(() => {
          switch (variant) {
            case "underline-close":
            case "underline-distant":
            case "left-border-close":
            case "left-border-distant":
              return {
                borderColor: getScalarValueColor(uncertainty, scalarValueType),
              };
            default:
              return {};
          }
        })()}
      >
        <Textarea
          ref={textareaRef as React.ForwardedRef<HTMLTextAreaElement>}
          rows={1} // Initial rows
          className={cn(
            className,
            "text-opacity-90",
            "h-auto max-h-64 min-h-8 resize-none whitespace-pre-wrap",
            "scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100",
          )}
          value={value}
          onChange={onChange}
          {...props}
          style={{
            ...(() => {
              switch (variant) {
                case "blur-small":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 2px 1px ${getScalarValueColor(
                      uncertainty,
                      scalarValueType,
                    )}`,
                  };
                case "blur-large":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 4px 2px ${getScalarValueColor(
                      uncertainty,
                      scalarValueType,
                    )}`,
                  };
                case "blur-xlarge":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 6px 3px ${getScalarValueColor(
                      uncertainty,
                      scalarValueType,
                    )}`,
                  };
                case "outline-small":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 1px ${getScalarValueColor(
                      uncertainty,
                      scalarValueType,
                    )}`,
                  };
                case "outline-large":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 2px ${getScalarValueColor(
                      uncertainty,
                      scalarValueType,
                    )}`,
                  };
                case "outline-xlarge":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 3px ${getScalarValueColor(
                      uncertainty,
                      scalarValueType,
                    )}`,
                  };
                default:
                  return {};
              }
            })(),
            overflowY: "auto",
          }}
        />
      </div>
    );
  },
);
StyledTextAreaInput.displayName = "StyledTextAreaInput";

export interface StyledCheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  variant?: ScalarValueVariant;
  uncertainty?: number;
  size: "sm" | "lg";
  scalarValueType: scalarValueType;
  functionFieldValue?: boolean | null;
}

export const StyledCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  StyledCheckboxProps
>(
  (
    { className, variant, uncertainty, size, scalarValueType, ...props },
    ref,
  ) => {
    // Checkboxes don't need editing state management - they're atomic actions
    const baseSize = size === "sm" ? 24 : 30;

    // Create style object with all necessary properties
    const containerStyle: React.CSSProperties = {
      flexShrink: 0,
      padding: 0,
      margin: 0,
      height:
        variant === "underline-close"
          ? `${baseSize + 2}px`
          : variant === "underline-distant"
            ? `${baseSize + 10}px`
            : `${baseSize}px`,
      width:
        variant === "left-border-close"
          ? `${baseSize + 4}px`
          : variant === "left-border-distant"
            ? `${baseSize + 12}px`
            : `${baseSize}px`,
      minWidth:
        variant === "left-border-close"
          ? `${baseSize + 4}px`
          : variant === "left-border-distant"
            ? `${baseSize + 12}px`
            : `${baseSize}px`,
      minHeight:
        variant === "underline-close"
          ? `${baseSize + 2}px`
          : variant === "underline-distant"
            ? `${baseSize + 10}px`
            : `${baseSize}px`,
    };

    // Add border properties based on variant
    if (variant === "underline-close" || variant === "underline-distant") {
      containerStyle.borderBottom = "2px solid";
      containerStyle.borderColor = getScalarValueColor(
        uncertainty,
        scalarValueType,
      );
      containerStyle.paddingBottom =
        variant === "underline-close" ? 0 : "0.5rem";
    } else if (
      variant === "left-border-close" ||
      variant === "left-border-distant"
    ) {
      containerStyle.borderLeft = "4px solid";
      containerStyle.borderColor = getScalarValueColor(
        uncertainty,
        scalarValueType,
      );
      containerStyle.paddingLeft =
        variant === "left-border-close" ? 0 : "0.5rem";
    }

    // Add shadow styles based on variant
    const checkboxStyle: React.CSSProperties = {};
    if (variant === "blur-small") {
      checkboxStyle.boxShadow = `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 2px 1px ${getScalarValueColor(uncertainty, scalarValueType)}`;
    } else if (variant === "blur-large") {
      checkboxStyle.boxShadow = `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 4px 2px ${getScalarValueColor(uncertainty, scalarValueType)}`;
    } else if (variant === "blur-xlarge") {
      checkboxStyle.boxShadow = `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 6px 3px ${getScalarValueColor(uncertainty, scalarValueType)}`;
    } else if (variant === "outline-small") {
      checkboxStyle.boxShadow = `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 1px ${getScalarValueColor(uncertainty, scalarValueType)}`;
    } else if (variant === "outline-large") {
      checkboxStyle.boxShadow = `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 2px ${getScalarValueColor(uncertainty, scalarValueType)}`;
    } else if (variant === "outline-xlarge") {
      checkboxStyle.boxShadow = `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 3px ${getScalarValueColor(uncertainty, scalarValueType)}`;
    }

    return (
      <div className="m-0 shrink-0 p-0" style={containerStyle}>
        <Checkbox
          ref={ref}
          className={cn(
            className,
            "h-full w-full shrink-0",
            size === "sm"
              ? "min-h-[24px] min-w-[24px]"
              : "min-h-[30px] min-w-[30px]",
          )}
          {...props}
          style={checkboxStyle}
        />
      </div>
    );
  },
);
StyledCheckbox.displayName = "StyledCheckbox";

export interface StyledSelectProps {
  variant?: ScalarValueVariant;
  uncertainty?: number;
  value?: string;
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  size: "sm" | "lg";
  children?: React.ReactNode;
  scalarValueType: scalarValueType;
}

export const StyledSelect = React.forwardRef<
  HTMLButtonElement,
  StyledSelectProps
>(
  (
    {
      className,
      variant,
      uncertainty,
      value,
      onValueChange,
      onOpenChange,
      disabled,
      placeholder,
      size,
      children,
      scalarValueType,
    },
    ref,
  ) => {
    const { setIsEditing } = useUiFormContext();

    const handleValueChange = (newValue: string) => {
      setIsEditing(true);
      onValueChange?.(newValue);
      // Reset editing state after value change
      setTimeout(() => setIsEditing(false), 0);
    };
    return (
      <div
        className={(() => {
          switch (variant) {
            case "underline-close":
              return "border-b-2 pb-0";
            case "underline-distant":
              return "border-b-2 pb-2";
            case "left-border-close":
              return "border-l-4 pl-0";
            case "left-border-distant":
              return "border-l-4 pl-2";
            default:
              return "";
          }
        })()}
        style={(() => {
          switch (variant) {
            case "underline-close":
            case "underline-distant":
            case "left-border-close":
            case "left-border-distant":
              return {
                borderColor: getScalarValueColor(uncertainty, scalarValueType),
              };
            default:
              return {};
          }
        })()}
      >
        <Select
          value={value}
          onValueChange={handleValueChange}
          onOpenChange={onOpenChange}
          disabled={disabled}
        >
          <SelectTrigger
            ref={ref}
            className={cn(
              className,
              size === "sm" ? "!h-[32px] text-sm" : "!h-[42px] text-sm",
              "text-opacity-90",
            )}
            style={(() => {
              switch (variant) {
                case "blur-small":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 2px 1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "blur-large":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 4px 2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "blur-xlarge":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 6px 3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-small":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 1px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-large":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 2px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                case "outline-xlarge":
                  return {
                    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow), 0 0 0 3px ${getScalarValueColor(uncertainty, scalarValueType)}`,
                  };
                default:
                  return {};
              }
            })()}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className={cn(className)}>{children}</SelectContent>
        </Select>
      </div>
    );
  },
);
StyledSelect.displayName = "StyledSelect";

function getFieldSchema(
  schema: any,
  path: string,
  currentSchema: any = schema,
): any {
  return getFieldSchemaInternal(schema, path, currentSchema);
}

// Component to display likelihood value with tooltip
const _LikelihoodDisplay: React.FC<{ likelihood?: number }> = ({
  likelihood,
}) => {
  if (likelihood === undefined || likelihood === null) return null;

  const percentValue = (likelihood * 100).toFixed(2);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground flex items-center text-xs">
            <Gauge className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          Model confidence: {percentValue}%
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

function getFieldSchemaInternal(
  schema: any,
  path: string,
  currentSchema: any = schema,
): any {
  // Guard against non-object schema
  if (!currentSchema || typeof currentSchema !== "object") {
    return null;
  }

  const pathSegments = path.split(".").filter((seg) => seg.length > 0);

  for (let i = 0; i < pathSegments.length; ) {
    const segment = pathSegments[i];

    // Resolve any $ref at the current level (safely)
    if (
      currentSchema &&
      typeof currentSchema === "object" &&
      currentSchema.$ref
    ) {
      const defs = schema?.$defs ?? {};
      const defName = String(currentSchema.$ref).replace("#/$defs/", "");
      currentSchema = defs[defName] ?? currentSchema; // fall back to current if not found
    }

    // Handle "anyOf" by trying each option (safely)
    if (
      currentSchema &&
      typeof currentSchema === "object" &&
      Array.isArray(currentSchema.anyOf)
    ) {
      for (const option of currentSchema.anyOf) {
        const fieldSchema = getFieldSchema(
          schema,
          pathSegments.slice(i).join("."),
          option,
        );
        if (fieldSchema) return fieldSchema;
      }
      return null; // no option contains the field
    }

    // Normalize type checks for nullable types like ["array", "null"] or ["object", "null"]
    const currentType = currentSchema?.type;
    const isArrayType =
      currentType === "array" ||
      (Array.isArray(currentType) && currentType.includes("array"));
    const isObjectType =
      currentType === "object" ||
      (Array.isArray(currentType) && currentType.includes("object"));

    // Handle arrays: move to items and skip index if present
    if (currentSchema && isArrayType) {
      currentSchema = currentSchema.items ?? {}; // tolerate missing items
      // Skip index (`*` or number)
      if (
        i + 1 < pathSegments.length &&
        (pathSegments[i + 1] === "*" || !isNaN(parseInt(pathSegments[i + 1])))
      ) {
        i += 1;
      }
      // Do not advance `i` here; we still need to process `segment` at this level
    }
    // Handle objects: dive into properties (guard when properties is missing)
    else if (currentSchema && (isObjectType || currentSchema.properties)) {
      const props = currentSchema.properties;
      if (props && typeof props === "object" && segment in props) {
        currentSchema = props[segment] ?? {};
        i += 1;
      } else if (segment === "*" || !isNaN(parseInt(segment))) {
        // Skip stray index segment outside array context
        i += 1;
      } else {
        // Incomplete/streaming schema: no properties yet — bail out safely
        return null;
      }
    }
    // Skip standalone numeric or "*" segments if not in array context
    else if (segment === "*" || !isNaN(parseInt(segment))) {
      i += 1;
    } else {
      // Unknown structure: bail out safely
      return null;
    }
  }

  // Resolve any final $ref (safely)
  if (
    currentSchema &&
    typeof currentSchema === "object" &&
    currentSchema.$ref
  ) {
    const defs = schema?.$defs ?? {};
    const defName = String(currentSchema.$ref).replace("#/$defs/", "");
    currentSchema = defs[defName] ?? currentSchema;
  }

  return currentSchema ?? null;
}

const createEmptyObject = (schema: any): any => {
  if (!schema) return {};

  // Add handling for primitive types
  if (schema.type === "string") return "";
  if (schema.type === "number" || schema.type === "integer") return 0;
  if (schema.type === "boolean") return false;

  const result: any = {};

  // Check if schema.properties exists before iterating over it
  if (schema.properties) {
    Object.keys(schema.properties).forEach((key) => {
      const prop = schema.properties[key];

      // Determine the effective type, accounting for `anyOf`, `oneOf`, `allOf`
      let propType = prop.type;
      let defaultValue;

      if (!propType && (prop.anyOf || prop.oneOf || prop.allOf)) {
        const options = prop.anyOf || prop.oneOf || prop.allOf;
        const nonNullOption = options.find(
          (option: any) => option.type !== "null",
        );
        propType = nonNullOption?.type || "object";
      }

      if (prop.default !== undefined) {
        defaultValue = prop.default;
      } else {
        // Assign default value based on resolved type
        if (propType === "string") defaultValue = "";
        else if (propType === "number" || propType === "integer")
          defaultValue = null;
        else if (propType === "boolean") defaultValue = false;
        else if (propType === "object") defaultValue = createEmptyObject(prop);
        else if (propType === "array")
          defaultValue = prop.items ? [createEmptyObject(prop.items)] : [];
        else defaultValue = null; // Fallback for unhandled types or unknown cases
      }

      result[key] = defaultValue;
    });
  }

  return result;
};
function pathExists(obj: any, path: string): boolean {
  if (!obj || typeof path !== "string") {
    return false;
  }

  const keys = path.split(".");

  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) {
      return false;
    }

    // Check if key is an array index
    const arrayMatch = key.match(/^(\d+)$/);

    if (arrayMatch) {
      const index = parseInt(arrayMatch[1], 10);
      if (!Array.isArray(current) || !(index in current)) {
        return false;
      }
      current = current[index];
    } else {
      // Check that current is an object before using 'in' operator
      if (typeof current !== "object" || !(key in current)) {
        return false;
      }
      current = current[key];
    }
  }

  return true;
}
const getNestedValue = (obj: Record<string, any>, path: string): any => {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return acc[key];
    }
    return undefined;
  }, obj);
};

const _replaceWildcards = (
  name: string,
  indices: number[],
  remove: boolean = false,
): string => {
  const parts = name.split(".");
  let wildcardCount = 0;
  if (remove) {
    return parts.filter((part) => part != "*").join(".");
  }
  return parts
    .map((part) => {
      if (part === "*") {
        // Make sure we have an index for this wildcard
        const replacement = indices[wildcardCount];
        wildcardCount++;
        return String(replacement);
      }
      return part;
    })
    .join(".");
};

// Convert a concrete data path (with numeric indices) to a schema path using '*'
// Example: cargo_list.0.value -> cargo_list.*.value
const toSchemaPath = (p: string): string => {
  return p
    .split(".")
    .map((seg) => (/^\d+$/.test(seg) ? "*" : seg))
    .join(".");
};

// Helper function to format ground truth values for display
const formatGroundTruthValue = (value: any): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      return `[${value.length} items]`;
    }
    return JSON.stringify(value);
  }
  const str = String(value);
  // Truncate long values
  if (str.length > 50) return str.slice(0, 47) + "...";
  return str;
};

// Type-adapted input for ground truth editing within the form
interface GroundTruthEditorInputProps {
  schema: JSONSchema | undefined | null;
  rootSchema?: JSONSchema;
  value: any;
  onChange: (next: any) => void;
  disabled?: boolean;
}

const GroundTruthEditorInput: React.FC<GroundTruthEditorInputProps> = ({
  schema,
  rootSchema: _rootSchema,
  value,
  onChange,
  disabled,
}) => {
  const eff = schema as JSONSchema | undefined;
  const type = eff?.type as string | undefined;
  const format = (eff as any)?.format as string | undefined;
  const hasEnum =
    Array.isArray((eff as any)?.enum) &&
    ((eff as any)?.enum as any[]).length > 0;

  // Check if nullable
  const typeArray = Array.isArray((eff as any)?.type)
    ? ((eff as any).type as any[])
    : null;
  const nullable = !!(typeArray && typeArray.includes("null"));

  // BOOLEAN
  if (type === "boolean") {
    return (
      <div className="flex h-full items-center">
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
          className="disabled:opacity-100"
          disabled={disabled}
        />
      </div>
    );
  }

  // ENUM
  if (hasEnum) {
    const options = ((eff as any).enum as any[]).filter((e) => e !== "");
    const current =
      value === null || value === undefined ? "__null__" : String(value);
    return (
      <Select
        value={current}
        onValueChange={(v) => {
          if (v === "__null__" && nullable) onChange(null);
          else onChange(v);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-full border px-2 text-xs">
          <SelectValue placeholder={nullable ? "Select..." : undefined} />
        </SelectTrigger>
        <SelectContent>
          {nullable && (
            <SelectItem
              key="__null__"
              value="__null__"
              className="text-muted-foreground text-xs"
            >
              <em>No selection</em>
            </SelectItem>
          )}
          {options.map((opt) => (
            <SelectItem
              key={String(opt)}
              value={String(opt)}
              className="text-xs"
            >
              {String(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // DATE
  if (type === "string" && format === "date") {
    const safeString = typeof value === "string" ? value : "";
    return (
      <Input
        type="date"
        value={safeString}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value || null)
        }
        disabled={disabled}
        className="w-full px-2 py-1 text-xs"
      />
    );
  }

  // DATE-TIME
  if (type === "string" && format === "date-time") {
    const safeString = typeof value === "string" ? value : "";
    return (
      <Input
        type="datetime-local"
        value={safeString}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value || null)
        }
        disabled={disabled}
        className="w-full px-2 py-1 text-xs"
      />
    );
  }

  // NUMBER / INTEGER
  if (type === "number" || type === "integer") {
    const isInteger = type === "integer";
    const str = value === null || value === undefined ? "" : String(value);
    return (
      <Input
        type="number"
        value={str}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const next = isInteger
            ? parseInt(e.target.value)
            : parseFloat(e.target.value);
          onChange(isNaN(next as any) ? null : next);
        }}
        disabled={disabled}
        className="w-full px-2 py-1 text-xs"
      />
    );
  }

  // OBJECT or ARRAY -> JSON editor
  if (type === "object" || type === "array") {
    const pretty = (() => {
      try {
        return typeof value === "string"
          ? value
          : JSON.stringify(value ?? null, null, 2);
      } catch {
        return String(value ?? "");
      }
    })();
    return (
      <Textarea
        className="h-32 w-full resize-none rounded-md border bg-muted p-2 text-xs"
        value={pretty}
        onChange={(e) => {
          const raw = e.target.value;
          try {
            const parsed = JSON.parse(raw);
            onChange(parsed);
          } catch {
            onChange(raw);
          }
        }}
        disabled={disabled}
      />
    );
  }

  // STRING default
  return (
    <Textarea
      className="h-20 w-full resize-none rounded-md border bg-muted p-2 text-xs"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
};

// Helper to darken a hex color by blending with black
const darkenColor = (hexColor: string, amount: number): string => {
  // Parse hex to RGB
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Blend with black (0,0,0)
  const factor = Math.max(0, Math.min(1, amount));
  const newR = Math.round(r * factor);
  const newG = Math.round(g * factor);
  const newB = Math.round(b * factor);

  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`.toUpperCase();
};

// Helper to get badge colors based on similarity value and scalar value type
const getGroundTruthBadgeColors = (
  similarity: number | undefined,
  scalarValueType: scalarValueType = "similarity",
): { bg: string; text: string; border: string } => {
  if (similarity === undefined || isNaN(similarity)) {
    return {
      bg: "var(--color-muted)",
      text: "var(--color-muted-foreground)",
      border: "var(--color-border)",
    };
  }

  // For mismatch mode: 0 = mismatch (amber), 1 = not mismatch (transparent/neutral)
  if (scalarValueType === "mismatch") {
    if (similarity === 1) {
      // Not a mismatch - neutral colors
      return {
      bg: "var(--color-muted)",
      text: "var(--color-muted-foreground)",
      border: "var(--color-border)",
    };
    }
    // Is a mismatch - warning colors
    return {
      bg: "color-mix(in oklab, var(--color-warning) 20%, transparent)",
      text: "var(--color-warning-foreground)",
      border: "var(--color-warning)",
    };
  }

  // Default similarity mode: Use the distances colormap with light background
  const bgColor = getColor(
    DISTANCES_COLORMAP,
    similarity,
    DISTANCES_INVERSE,
    0.15,
  );
  // Get the base color at full saturation, then darken it significantly for readable text
  const baseColor = getColor(
    DISTANCES_COLORMAP,
    similarity,
    DISTANCES_INVERSE,
    1,
  );
  const textColor = darkenColor(baseColor, 0.5); // Darken to 35% of original brightness
  // Border is slightly more saturated than background
  const borderColor = getColor(
    DISTANCES_COLORMAP,
    similarity,
    DISTANCES_INVERSE,
    0.4,
  );
  return { bg: bgColor, text: textColor, border: borderColor };
};

// Ground Truth Badge component - displays the ground truth value next to the label with edit popover
const GroundTruthBadge: React.FC<{
  groundTruthData: Record<string, any> | undefined;
  predictionData: Record<string, any> | undefined;
  onGroundTruthChange?: (fieldPath: string, newValue: any) => void;
  onToggleMismatch?: (fieldPath: string) => void;
  fieldPath: string;
  fieldSchema: JSONSchema | undefined;
  rootSchema: JSONSchema | undefined;
  similarity?: number;
  isInMismatches?: boolean;
  id: string;
  scalarValueType?: scalarValueType;
}> = ({
  groundTruthData,
  predictionData,
  onGroundTruthChange,
  onToggleMismatch,
  fieldPath,
  fieldSchema,
  rootSchema,
  similarity,
  isInMismatches = false,
  id,
  scalarValueType = "similarity",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editValue, setEditValue] = useState<any>(null);
  const [isSaving, _setIsSaving] = useState(false);

  if (!groundTruthData) return null;

  const groundTruthValue = getNestedValue(groundTruthData, fieldPath);
  if (groundTruthValue === undefined) return null;

  const predictionValue = predictionData
    ? getNestedValue(predictionData, fieldPath)
    : undefined;
  const displayValue = formatGroundTruthValue(groundTruthValue);
  const canEdit = !!onGroundTruthChange;
  const canToggleMismatch = !!onToggleMismatch;
  const colors = getGroundTruthBadgeColors(similarity, scalarValueType);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setEditValue(groundTruthValue);
    }
  };

  const handleSave = () => {
    console.log(
      "[GroundTruthBadge:handleSave] Called for fieldPath:",
      fieldPath,
    );
    console.log("[GroundTruthBadge:handleSave] editValue:", editValue);
    console.log(
      "[GroundTruthBadge:handleSave] onGroundTruthChange exists:",
      !!onGroundTruthChange,
    );

    if (!onGroundTruthChange) {
      console.log(
        "[GroundTruthBadge:handleSave] No onGroundTruthChange callback, returning",
      );
      return;
    }

    // Capture the value before any state changes
    const valueToSave = editValue;
    console.log(
      "[GroundTruthBadge:handleSave] Captured valueToSave:",
      valueToSave,
    );

    // Close the popover first
    setIsOpen(false);
    console.log(
      "[GroundTruthBadge:handleSave] Popover closed, invoking callback...",
    );

    // Invoke callback directly - the parent's debounce function is now stable
    // (no longer depends on updateMutation which was causing recreation)
    onGroundTruthChange(fieldPath, valueToSave);
    console.log("[GroundTruthBadge:handleSave] Callback invoked");
  };

  const handleToggleMismatch = () => {
    if (!onToggleMismatch) return;
    onToggleMismatch(fieldPath);
    setIsOpen(false);
  };

  const handleReplaceByPrediction = () => {
    if (predictionValue === undefined) return;
    setEditValue(predictionValue);
  };

  const handleCancel = () => {
    setEditValue(groundTruthValue);
    setIsOpen(false);
  };

  if (!canEdit) {
    // Read-only badge with tooltip
    return (
      <TooltipProvider key={id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex max-w-[150px] cursor-context-menu items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: colors.bg,
                color: colors.text,
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: colors.border,
              }}
            >
              <span className="truncate">{displayValue}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="mb-1 text-xs text-muted-foreground">Ground Truth:</div>
            {typeof groundTruthValue === "object" ? (
              <pre className="max-h-64 overflow-auto rounded border bg-muted p-1 text-xs leading-snug font-medium whitespace-pre-wrap text-foreground">
                {JSON.stringify(groundTruthValue, null, 2)}
              </pre>
            ) : (
              <div className="font-medium break-words whitespace-pre-wrap">
                {String(groundTruthValue)}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Check if prediction value differs from ground truth
  const _predictionDiffers =
    predictionValue !== undefined &&
    JSON.stringify(predictionValue) !== JSON.stringify(groundTruthValue);

  // Editable badge with popover
  return (
    <div className="inline-flex items-center gap-1">
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex max-w-[150px] cursor-pointer items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80"
            style={{
              backgroundColor: colors.bg,
              color: colors.text,
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: colors.border,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="truncate">{displayValue}</span>
            <Pencil className="h-2.5 w-2.5 shrink-0 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-3"
          align="start"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-2xs font-medium text-foreground">
                Ground Truth
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReplaceByPrediction}
                disabled={isSaving}
                className="text-2xs h-7"
              >
                Replace by prediction
              </Button>
            </div>
            <GroundTruthEditorInput
              schema={fieldSchema}
              rootSchema={rootSchema}
              value={editValue}
              onChange={setEditValue}
              disabled={isSaving}
            />

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="h-7 text-xs"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {canToggleMismatch && scalarValueType === "mismatch" && (
        <div
          className="inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            checked={!isInMismatches}
            onCheckedChange={() => handleToggleMismatch()}
            className={cn(
              "h-3.5 w-6 data-[state=checked]:bg-success data-[state=unchecked]:bg-warning",
              "[&_span]:h-2.5 [&_span]:w-2.5 [&_span]:data-[state=checked]:translate-x-[10px] [&_span]:data-[state=unchecked]:translate-x-[2px]",
            )}
            title={isInMismatches ? "Mark as OK" : "Mark as mismatch"}
          />
          <span
            className={cn(
              "text-[10px] font-medium",
              isInMismatches ? "text-warning-foreground" : "text-success",
            )}
          >
            {isInMismatches ? "Mismatch" : "✓ OK"}
          </span>
        </div>
      )}
    </div>
  );
};

interface ArrayRendererItemProps {
  item: any;
  innerIdx: number;
  arrayBaseName: string;
  enumOptions: any[] | null;
  itemsSchema: any;
  labelItem: string;
  elementKey: string;
  currentPath: string;
  className?: string;
  disabled: boolean;
  isStreaming: boolean;
  size: "sm" | "lg";
  handleRemoveItem: (index: number) => void;
  setLikelihoods: (likelihoods: any) => void;
  setSourcesFieldPath?: (fieldPath: string | null) => void;
}

// New component to handle individual array items
const ArrayRendererItem = React.memo<ArrayRendererItemProps>(
  ({
    item,
    innerIdx,
    arrayBaseName,
    enumOptions,
    itemsSchema,
    labelItem,
    elementKey,
    currentPath,
    className,
    disabled,
    isStreaming,
    size,
    handleRemoveItem,
    setLikelihoods,
    setSourcesFieldPath: _setSourcesFieldPath,
  }) => {
    const {
      form,
      config,
      scalarValueType,
      disabled: globalDisabled,
    } = useUiFormContext();

    const itemPath = `${arrayBaseName}.${innerIdx}`;
    const itemKey = `${elementKey}-item-${innerIdx}`;

    if (enumOptions) {
      // Simple layout for enum arrays without accordion
      return (
        <div
          key={itemKey}
          className={cn(
            "mt-2 flex flex-row items-center gap-2",
            className,
            "bg-transparent text-xs shadow-none outline-transparent outline-none",
          )}
        >
          <FormField
            control={form.control}
            name={`${currentPath}.${innerIdx}`}
            render={({ field: formField }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <StyledSelect
                    size={size}
                    disabled={disabled}
                    value={toSelectValue(formField.value)}
                    onValueChange={(v) => {
                      formField.onChange(fromSelectValue(v));
                      setLikelihoods((prev: Record<string, any>) => {
                        const newLikelihoods = { ...prev };
                        set(newLikelihoods, `${currentPath}.${innerIdx}`, 1);
                        return newLikelihoods;
                      });
                    }}
                    className={className}
                    scalarValueType={scalarValueType}
                  >
                    {enumOptions.map((raw: any) => {
                      const itemValue = toSelectValue(raw);
                      const label =
                        itemValue === EMPTY_OPTION
                          ? "(Empty)"
                          : itemValue.charAt(0).toUpperCase() +
                            itemValue.slice(1);
                      return (
                        <SelectItem
                          key={itemValue}
                          value={itemValue}
                          className={cn(
                            className,
                            "rounded-none border-none outline-transparent",
                          )}
                        >
                          {label}
                        </SelectItem>
                      );
                    })}
                  </StyledSelect>
                </FormControl>
              </FormItem>
            )}
          />
          {!globalDisabled && (
            <Button
              size={size === "sm" ? "sm" : "icon"}
              type="button"
              variant="outline"
              onClick={() => handleRemoveItem(innerIdx)}
              className={cn(className, "shrink-0 px-2 py-1")}
              disabled={disabled || isStreaming}
              aria-label={"Delete"}
            >
              <Trash className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    }

    if (!itemsSchema && process.env.NODE_ENV !== "production") {
      const details = {
        arrayBaseName,
        currentPath,
        innerIdx,
        itemPath,
        itemType: Array.isArray(item) ? "array" : typeof item,
        hasEnumOptions: Boolean(enumOptions),
      };
      console.error(
        `[UiForm][ArrayRendererItem] Missing itemsSchema before item render :: ${JSON.stringify(details)}`,
      );
    }

    if (!itemsSchema) {
      return (
        <div key={itemKey} className="flex w-full flex-row items-end gap-1">
          <div className="min-w-0 flex-1">
            <PrimitiveRenderer
              path={currentPath + "." + innerIdx}
              className={className}
            />
          </div>
          {!globalDisabled && (
            <Button
              size={size === "sm" ? "sm" : "icon"}
              type="button"
              variant="outline"
              onClick={() => handleRemoveItem(innerIdx)}
              className={cn(
                className,
                "shrink-0 px-2 py-1",
                size === "sm" ? "mr-1" : "mr-2",
              )}
              disabled={disabled || isStreaming}
              aria-label={"Delete"}
            >
              <Trash className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    }

    // Check if it's a primitive item
    const isPrimitive =
      (itemsSchema.type ?? "") !== "object" &&
      !itemsSchema.$ref &&
      !itemsSchema.anyOf?.some((o: any) => o.type === "object" || o.$ref);

    if (isPrimitive) {
      return (
        <div key={itemKey} className="flex w-full flex-row items-end gap-1">
          {/* Make the input area grow to full width */}
          <div className="min-w-0 flex-1">
            <PrimitiveRenderer
              path={currentPath + "." + innerIdx}
              className={className}
            />
          </div>

          {/* Ensure the delete button doesn't stretch */}
          {!globalDisabled && (
            <Button
              size={size === "sm" ? "sm" : "icon"}
              type="button"
              variant="outline"
              onClick={() => handleRemoveItem(innerIdx)}
              className={cn(
                className,
                "shrink-0 px-2 py-1",
                size === "sm" ? "mr-1" : "mr-2",
              )}
              disabled={disabled || isStreaming}
              aria-label={"Delete"}
            >
              <Trash className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    }

    // Complex object item: return only an AccordionItem. The parent level wraps these in a single Accordion.
    return (
      <AccordionItem
        key={`${elementKey}-idx-${innerIdx}`}
        value={`${elementKey}-idx-${innerIdx}-0`}
        data-accordion-path={`${currentPath}.${innerIdx}`}
        className={cn(
          className,
          "rounded-none border-x-0 border-t-0 border-b shadow-none last:border-b-0",
        )}
      >
        <div
          className={cn(
            className,
            "flex flex-row items-center rounded-none border-none shadow-none",
            size === "sm" ? "h-[40px]" : "h-[54px]",
          )}
        >
          <div className="flex-1">
            <AccordionTrigger className="pr-2 pl-2">
              <div className="flex flex-row items-center gap-2 text-xs">
                {labelItem + ` #${innerIdx + 1}`}
              </div>
            </AccordionTrigger>
          </div>

          {!globalDisabled && (
            <Button
              size={size === "sm" ? "iconSm" : "icon"}
              type="button"
              variant="ghost"
              onClick={() => handleRemoveItem(innerIdx)}
              className={cn(className, size === "sm" ? "mr-1" : "mr-2")}
              disabled={disabled || isStreaming}
              aria-label={"Delete"}
            >
              <Trash className="h-3 w-3" />
            </Button>
          )}
        </div>

        <AccordionContent
          className={cn(
            className,
            "rounded-none border-x-0 border-t border-b-0 px-3 pt-0 pb-0",
          )}
        >
          <ObjectRenderer
            path={currentPath + "." + innerIdx}
            className={className}
            isArrayItem={true}
            isLoneObject={true}
          />
        </AccordionContent>
      </AccordionItem>
    );
  },
);

ArrayRendererItem.displayName = "ArrayRendererItem";

interface ArrayRendererProps {
  path: string;
  className?: string;
}

const ArrayRenderer: React.FC<ArrayRendererProps> = ({ path, className }) => {
  // Always call ALL hooks first, before any conditional logic
  const {
    schema,
    setSchema,
    form,
    isStreaming,
    disabled,
    size,
    setLikelihoods,
    setSourcesFieldPath,
    config,
    propertyEditorMode,
    showPropertyEditorPencil,
  } = useUiFormContext();
  const { projectId } = useUiFormContext();

  const arraySchema = getFieldSchema(schema, path);

  // NEW: normalize array schema
  const { schema: normalizedArraySchema } = unwrapSchema(arraySchema, schema);

  if (!arraySchema) return null;

  const currentPath = path;

  let itemsSchema: any = null;
  let enumOptions: any[] | null = null;

  // Prefer normalized array shape
  if (
    (normalizedArraySchema?.type === "array" ||
      (Array.isArray(normalizedArraySchema?.type) &&
        normalizedArraySchema.type.includes("array"))) &&
    normalizedArraySchema?.items
  ) {
    itemsSchema = unwrapSchema(normalizedArraySchema.items, schema).schema;
  } else if (
    normalizedArraySchema?.anyOf ||
    normalizedArraySchema?.oneOf ||
    normalizedArraySchema?.allOf
  ) {
    const combos =
      normalizedArraySchema.anyOf ||
      normalizedArraySchema.oneOf ||
      normalizedArraySchema.allOf;

    const arrayOpt = combos.find(
      (opt: any) => opt?.type === "array" || opt?.items,
    );
    if (arrayOpt) {
      itemsSchema = unwrapSchema(arrayOpt.items ?? arrayOpt, schema).schema;
    }
  }

  // If items is a referenced / unioned enum, unwrap gives it to us
  if (itemsSchema?.enum) {
    enumOptions = itemsSchema.enum;
  }

  // Check for X-FieldTranslation first, then fall back to translations or array name
  const label = path.split(".").pop();
  const labelItem = itemsSchema?.title || "Item";
  const isArrayComputedField = false;
  // Read current value without mutating form state during render.
  // Mutating here triggers React warnings and can create render loops.
  const rawArrayData = getNestedValue(form.getValues(), currentPath);
  const arrayData = Array.isArray(rawArrayData) ? rawArrayData : [];

  if (!itemsSchema && process.env.NODE_ENV !== "production") {
    const details = {
      path,
      currentPath,
      arrayLength: Array.isArray(arrayData) ? arrayData.length : null,
      arraySchemaType: arraySchema?.type ?? null,
      normalizedArraySchemaType: normalizedArraySchema?.type ?? null,
      normalizedArraySchemaHasItems: Boolean(normalizedArraySchema?.items),
      normalizedArraySchemaItemsType:
        normalizedArraySchema?.items === null
          ? "null"
          : Array.isArray(normalizedArraySchema?.items)
            ? "array"
            : typeof normalizedArraySchema?.items,
      normalizedArraySchemaItemsKeys:
        normalizedArraySchema?.items &&
        typeof normalizedArraySchema.items === "object" &&
        !Array.isArray(normalizedArraySchema.items)
          ? Object.keys(
              normalizedArraySchema.items as Record<string, unknown>,
            ).slice(0, 25)
          : [],
      normalizedArraySchemaKeys:
        normalizedArraySchema && typeof normalizedArraySchema === "object"
          ? Object.keys(normalizedArraySchema as Record<string, unknown>).slice(
              0,
              25,
            )
          : [],
      comboKinds: {
        anyOf: Array.isArray(normalizedArraySchema?.anyOf)
          ? normalizedArraySchema.anyOf.length
          : 0,
        oneOf: Array.isArray(normalizedArraySchema?.oneOf)
          ? normalizedArraySchema.oneOf.length
          : 0,
        allOf: Array.isArray(normalizedArraySchema?.allOf)
          ? normalizedArraySchema.allOf.length
          : 0,
      },
      isArrayComputedField,
    };
    console.error(
      `[UiForm][ArrayRenderer] Could not resolve itemsSchema for array field :: ${JSON.stringify(details)}`,
    );
  }

  const handleAddItem = () => {
    // Special handling for enum arrays
    if (enumOptions) {
      // Prefer the first non-empty option, fallback to empty string if needed
      const first = enumOptions.find((opt: any) => opt !== "") ?? "";
      const newValue = first;
      // Set the value in the form
      const currentValue = getNestedValue(form.getValues(), currentPath) || [];
      const newArray = [...currentValue, newValue];
      form.setValue(currentPath, newArray, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });

      // Update likelihood for the new array item
      const newItemPath = `${currentPath}.${currentValue.length}`;
      setLikelihoods((prev: Record<string, any>) => {
        const newLikelihoods = { ...prev };
        set(newLikelihoods, newItemPath, 1);
        return newLikelihoods;
      });
      return;
    }

    // Original code for object arrays...
    if (!itemsSchema) {
      console.error("Could not find items schema for", path);
      return;
    }

    // Create empty object based on the item schema
    const newItem = createEmptyObject(itemsSchema);

    // Set the value in the form - use the resolved current path
    const currentValue = getNestedValue(form.getValues(), currentPath) || [];
    const newIndex = currentValue.length;

    // Create a new array with the added item
    const newArray = [...currentValue, newItem];

    // Set the value at the correct path
    form.setValue(currentPath, newArray, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });

    // Set likelihoods to 1 for all fields in the new array item
    const setLikelihoodsForObject = (obj: any, basePath: string) => {
      Object.keys(obj).forEach((key) => {
        const fullPath = basePath ? `${basePath}.${key}` : key;
        if (obj[key] !== null && typeof obj[key] === "object") {
          setLikelihoodsForObject(obj[key], fullPath);
        } else {
          setLikelihoods((prev: Record<string, any>) => {
            const newLikelihoods = { ...prev };
            set(newLikelihoods, fullPath, 1);
            return newLikelihoods;
          });
        }
      });
    };

    // Use the resolved path with the new index
    const newItemPath = `${currentPath}.${newIndex}`;
    setLikelihoodsForObject(newItem, newItemPath);
  };

  const handleRemoveItem = (index: number) => {
    // Use the resolved current path to get and update the array
    const currentValue = getNestedValue(form.getValues(), currentPath) || [];
    const newValue = [...currentValue];
    newValue.splice(index, 1);
    form.setValue(currentPath, newValue, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <div className={cn("flex flex-col")} key={path}>
      <div className="group flex flex-row gap-2 pt-4" key={`${path}-header`}>
        <FormLabel
          className={cn(
            className,
            "mb-0 flex items-center justify-center border-none bg-transparent shadow-none outline-transparent hover:bg-transparent",
          )}
        >
          {label}
        </FormLabel>

        {setSchema && showPropertyEditorPencil !== false && (
          <Dialog modal>
            <DialogTrigger asChild>
              <button
                className="relative ml-auto cursor-pointer opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                type="button"
                aria-label="Edit field"
              >
                <SquarePen className="absolute top-0 right-0 size-[14px]" />
              </button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[80vh] gap-0 overflow-y-auto p-0"
              onOpenAutoFocus={(e) => {
                e.preventDefault();
              }}
              onPointerDownOutside={(e) => {
                e.preventDefault();
              }}
              onInteractOutside={(e) => {
                e.preventDefault();
              }}
              onEscapeKeyDown={(e) => {
                e.preventDefault();
              }}
            >
              <DialogTitle className="px-4 pt-3 pb-0 text-lg font-semibold">
                Edit field
              </DialogTitle>
              <PropertyEditor
                property={arraySchema}
                propertyKey={path}
                setDropdownOpen={() => {}}
                jsonSchema={schema}
                setJsonSchema={setSchema}
                editMode={propertyEditorMode ?? "editable"}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Wrap object items in a single Accordion to ensure only one open per level */}
      {Array.isArray(arrayData) &&
      itemsSchema &&
      (itemsSchema.type === "object" ||
        itemsSchema.$ref ||
        itemsSchema.anyOf?.some((o: any) => o.type === "object" || o.$ref)) ? (
        <Accordion
          type="single"
          collapsible
          defaultValue={
            Array.isArray(arrayData) && arrayData.length > 0
              ? `${path}-idx-0-0`
              : undefined
          }
          className={cn(
            "rounded-md outline-transparent",
            className,
            "mt-2 overflow-hidden bg-transparent outline",
          )}
        >
          {arrayData.map((item: any, innerIdx: number) => (
            <ArrayRendererItem
              key={`${path}-item-${innerIdx}`}
              item={item}
              innerIdx={innerIdx}
              arrayBaseName={path}
              enumOptions={null}
              itemsSchema={itemsSchema}
              labelItem={labelItem}
              elementKey={path}
              currentPath={currentPath}
              className={className}
              disabled={disabled ?? false}
              isStreaming={isStreaming ?? false}
              size={size}
              handleRemoveItem={handleRemoveItem}
              setLikelihoods={setLikelihoods}
              setSourcesFieldPath={setSourcesFieldPath}
            />
          ))}
          {/*<div key={`${path}-item-${innerIdx}`} className={cn(className, "border-r-0 border-l-0 border-t-0 border-b last:border-b-0")}> </div>*/}
        </Accordion>
      ) : Array.isArray(arrayData) ? (
        arrayData.map((item: any, innerIdx: number) => (
          <ArrayRendererItem
            key={`${path}-item-${innerIdx}`}
            item={item}
            innerIdx={innerIdx}
            arrayBaseName={path}
            enumOptions={enumOptions}
            itemsSchema={itemsSchema}
            labelItem={labelItem}
            elementKey={path}
            currentPath={currentPath}
            className={className}
            disabled={disabled ?? false}
            isStreaming={isStreaming ?? false}
            size={size}
            handleRemoveItem={handleRemoveItem}
            setLikelihoods={setLikelihoods}
            setSourcesFieldPath={setSourcesFieldPath}
          />
        ))
      ) : null}

      {disabled ? (
        arrayData.length === 0 && (
          <div className="mt-2 flex px-2" key={`${path}-empty`}>
            <span className="text-muted-foreground text-xs italic">
              List empty
            </span>
          </div>
        )
      ) : (
        <div className="mt-2 flex" key={`${path}-add-button`}>
          <div>
            <Button
              size={size}
              className={cn(className, "px-2")}
              type="button"
              variant="outline"
              onClick={handleAddItem}
              disabled={isStreaming}
            >
              <Plus className="mr-2 size-5" />
              <span className="">{label}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

interface PrimitiveRendererProps {
  path: string;
  className?: string;
}
const PrimitiveRenderer: React.FC<PrimitiveRendererProps> = ({
  path,
  className,
}) => {
  // Always call your hooks at the top.
  const {
    form,
    formFieldIdPrefix,
    size,
    likelihoods,
    scalarValueDisplay,
    scalarValueType,
    isProcessing,
    isStreaming,
    disabled,
    titlePosition,
    setLikelihoods,
    setSourcesFieldPath,
    config,
    isEditing,
    setIsEditing,
    propertyEditorMode,
    showPropertyEditorPencil,
    schema,
    setSchema,
    validationFlags,
    setValidationFlags,
    showVerifiedProperty,
    projectId,
  } = useUiFormContext();

  const formData = form.getValues();
  const displayDescription = config?.descriptions ?? false;
  const [editedValue, setEditedValue] = React.useState<
    string | null | undefined
  >(undefined);

  const rawSubschema = getFieldSchema(schema, path); // Renamed from subschema to rawSubschema
  const fieldValue = form.getValues(path);
  const committedEditedValue =
    fieldValue !== null && fieldValue !== undefined ? String(fieldValue) : "";
  const [isDraftActive, setIsDraftActive] = React.useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  // --- FIX STARTS HERE ---
  // This block replaces the old complex logic for determining field type.
  // We use the `unwrapSchema` helper to correctly handle nullable types and resolve any nested $refs.
  // This simplifies the logic for determining the field's type, options, and whether it's required.
  const { schema: subschema, nullable } = unwrapSchema(rawSubschema, schema);
  const isRequired = !nullable;
  const isComputedField = false;
  const isFunctionField = Boolean(
    (subschema as any)?.["X-FunctionField"] ||
      (rawSubschema as any)?.["X-FunctionField"],
  );
  let fieldType: string | undefined;
  let enumOptions: any[] | undefined;

  if (subschema.enum) {
    fieldType = "enum";
    enumOptions = subschema.enum;
  } else {
    // With the unwrapped schema, we no longer need complex checks inside anyOf/oneOf.
    // The core type definition is directly available in the new `subschema` variable.
    fieldType =
      subschema.format === "date"
        ? "date"
        : subschema.format === "iso-time"
          ? "time"
          : subschema.format === "date-time"
            ? "datetime"
            : subschema.type === "number"
              ? "number"
              : subschema.type === "integer"
                ? "integer"
                : subschema.type === "boolean"
                  ? "boolean"
                  : "text";
  }
  // --- FIX ENDS HERE ---

  const inputType =
    fieldType === "boolean"
      ? "checkbox"
      : fieldType === "date"
        ? "date"
        : fieldType === "time"
          ? "time"
          : fieldType === "datetime"
            ? "datetime-local"
            : fieldType === "number" || fieldType === "integer"
              ? "number"
              : "text";
  // Centralized form data change handler - handles all parsing and validation
  const handleFormDataChange = React.useCallback(
    (
      formField: ControllerRenderProps<Record<string, any>, string>,
      rawValue: any,
    ) => {
      let parsedValue = rawValue;
      // Handle parsing based on field and input types
      if (typeof rawValue === "string") {
        // Parse numbers
        if (fieldType === "number") {
          const parsed = parseFloat(rawValue);
          parsedValue = isNaN(parsed) ? null : parsed;
        } else if (fieldType === "integer") {
          const parsed = parseInt(rawValue);
          parsedValue = isNaN(parsed) ? null : parsed;
        }
        // Handle time format completion
        else if (inputType === "time" && /^\d{1,2}:\d{2}$/.test(rawValue)) {
          parsedValue = rawValue + ":00";
        }
        // Handle datetime-local format completion
        else if (
          inputType === "datetime-local" &&
          /^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}$/.test(rawValue)
        ) {
          parsedValue = rawValue + ":00";
        }
        // Convert empty string to null for optional fields
        else if (rawValue === "") {
          parsedValue = null;
        }
      }
      // Apply autoFormatDateTimeFields validation if needed
      let validatedValue = parsedValue;
      if (subschema && subschema.format && typeof parsedValue === "string") {
        try {
          const tempSchema = {
            type: "object",
            properties: {
              [path.split(".").pop()!]: subschema,
            },
          };
          const validatedData = autoFormatDateTimeFields(
            { [path.split(".").pop()!]: parsedValue },
            tempSchema,
          );
          validatedValue = validatedData[path.split(".").pop()!];
        } catch (error) {
          console.warn(
            `autoFormatDateTimeFields validation failed for ${path}:`,
            error,
          );
        }
      }
      // Then trigger the change

      formField.onChange(validatedValue);
      // Update the likelihood
      setLikelihoods((prev: Record<string, any>) => {
        const newObj = { ...prev };
        set(newObj, path, 1);
        return newObj;
      });
    },
    [path, subschema, fieldType, inputType, setLikelihoods],
  );

  if (!rawSubschema) {
    // Changed check to use rawSubschema
    return <i>Bad schema path: {path}</i>;
  }
  const label = subschema?.title || path.split(".").pop() || "";
  // Improved isMultiline logic to handle nested maxLength in anyOf/oneOf/allOf
  const isMultiline = (() => {
    // Check if this is a string field (directly or within schema combinations)
    const isStringField =
      subschema.type === "string" ||
      subschema.anyOf?.some((opt: any) => opt.type === "string") ||
      subschema.oneOf?.some((opt: any) => opt.type === "string") ||
      subschema.allOf?.some((opt: any) => opt.type === "string");
    if (!isStringField) return false;
    // Find any maxLength constraints
    const maxLengths: number[] = [];
    // Direct maxLength
    if (subschema.maxLength !== undefined) {
      maxLengths.push(subschema.maxLength);
    }
    // Check in anyOf
    if (subschema.anyOf) {
      subschema.anyOf.forEach((option: any) => {
        if (option.type === "string" && option.maxLength !== undefined) {
          maxLengths.push(option.maxLength);
        }
      });
    }
    // Check in oneOf
    if (subschema.oneOf) {
      subschema.oneOf.forEach((option: any) => {
        if (option.type === "string" && option.maxLength !== undefined) {
          maxLengths.push(option.maxLength);
        }
      });
    }
    // Check in allOf
    if (subschema.allOf) {
      subschema.allOf.forEach((option: any) => {
        if (option.type === "string" && option.maxLength !== undefined) {
          maxLengths.push(option.maxLength);
        }
      });
    }
    // If we found any maxLength constraints, check if any are <= 100
    if (maxLengths.length > 0) {
      // Get the smallest maxLength (most restrictive)
      const smallestMaxLength = Math.min(...maxLengths);
      return smallestMaxLength > 500;
    }
    // Default to multiline if no constraints found
    return false;
  })();
  // Helper function to get glossary translation

  //console.log("Project Id", projectId);
  const LabelContent = () => {
    const onHover =
      setSourcesFieldPath && !isEditing
        ? () => {
            setSourcesFieldPath(path);
          }
        : undefined;
    const onMouseEnter = onHover
      ? (e: React.MouseEvent<any>) => {
          const target = e.target as HTMLElement;
          // Don't trigger if we're interacting with popover/calendar components
          if (
            !target.closest("[data-radix-popper-content-wrapper]") &&
            !target.closest('[role="button"]')
          ) {
            onHover();
          }
        }
      : undefined;
    return (
      <div
        className="flex w-full min-w-0 flex-row flex-wrap gap-1 break-all"
        onClick={(e) => e.stopPropagation()}
      >
        <FormLabel
          className={cn(
            "flex cursor-pointer items-center gap-1",
            size === "sm" ? "text-xs" : "text-xs",
          )}
          onMouseEnter={onMouseEnter}
        >
          {label}
          {isRequired && (
            <span className="text-destructive">*</span>
          )}
        </FormLabel>
        <GroundTruthBadge
          groundTruthData={config?.groundTruthData}
          predictionData={config?.predictionData}
          onGroundTruthChange={config?.onGroundTruthChange}
          onToggleMismatch={config?.onToggleMismatch}
          fieldPath={path}
          fieldSchema={subschema}
          rootSchema={schema}
          similarity={getNestedValue(likelihoods, path)}
          isInMismatches={config?.mismatches?.includes(path) ?? false}
          id={`${path}-ground-truth`}
          scalarValueType={scalarValueType}
        />
        {subschema.description && displayDescription && (
          <div className="relative inline-block">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info
                    className={cn(
                      className,
                      "h-[14px] w-[14px] cursor-pointer border-none bg-transparent shadow-none outline-transparent outline-none",
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[80vw] p-0">
                  <TooltipArrow />
                  <div
                    className={cn(
                      className,
                      "block max-h-[60vh] max-w-[260px] overflow-y-auto rounded-md p-3 text-xs break-words whitespace-normal outline-none",
                    )}
                  >
                    {subschema.description}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {false && subschema["X-FieldPrompt"] && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center rounded-full border border-foreground px-1 text-xs font-light">
                  <Code
                    className={cn(
                      className,
                      "h-[14px] w-[14px] cursor-pointer border-none bg-transparent shadow-none outline-transparent outline-none",
                    )}
                  />
                  Prompt
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="w-[200px] p-0"
                sideOffset={2}
              >
                <TooltipArrow />
                <div
                  className={cn(
                    "border border-foreground",
                    className,
                    "focus-ring-0 rounded-md p-3 text-xs shadow-none outline-transparent outline-none",
                  )}
                >
                  {subschema["X-FieldPrompt"]}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {setSourcesFieldPath && !isEditing && config?.showSources && (
          <Search
            className={cn(
              className,
              "text-muted-foreground h-[14px] w-[14px] cursor-pointer border-none bg-transparent shadow-none outline-transparent outline-none",
            )}
            onMouseEnter={onMouseEnter}
          />
        )}
        {/* json schema editor button */}
        {setSchema && showPropertyEditorPencil !== false && (
          <Dialog modal>
            <DialogTrigger asChild>
              <button
                className="relative ml-auto cursor-pointer opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                type="button"
              >
                <SquarePen className="absolute top-0 right-0 size-[14px]" />
              </button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[80vh] gap-0 overflow-y-auto p-0"
              onOpenAutoFocus={(e) => {
                e.preventDefault();
              }}
              onPointerDownOutside={(e) => {
                e.preventDefault();
              }}
              onInteractOutside={(e) => {
                e.preventDefault();
              }}
            >
              <DialogTitle className="px-4 pt-3 pb-0 text-lg font-semibold">
                Edit field
              </DialogTitle>
              <PropertyEditor
                property={rawSubschema}
                propertyKey={path}
                setDropdownOpen={() => {}}
                jsonSchema={schema}
                setJsonSchema={setSchema}
                editMode={propertyEditorMode ?? "editable"}
              />
            </DialogContent>
          </Dialog>
        )}

        {showVerifiedProperty === true && (
          <div
            className="ml-auto flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-muted-foreground text-xs font-normal">
              verified
            </span>
            <Switch
              checked={Boolean(getNestedValue(validationFlags, path))}
              onCheckedChange={(checked) => {
                const updatedValidation = { ...validationFlags };
                set(updatedValidation, path, checked);
                setValidationFlags(updatedValidation);
              }}
            />
          </div>
        )}
      </div>
    );
  };
  // Update the isFieldDisabled logic
  const isFieldUndefined =
    fieldValue === "Undefined" || fieldValue === undefined;
  const isFieldDisabled =
    disabled ||
    isProcessing ||
    isFunctionField ||
    (isStreaming && isFieldUndefined); // Only disable if streaming AND field is "Undefined"; also lock function fields
  const activeEditedValue = resolveDraftValue(
    committedEditedValue,
    editedValue,
    isDraftActive || isPopoverOpen,
  );
  // Common interaction handlers for all field types
  const handleFieldClick = () => {
    // Always set editing state and update sources field path
    // This handles both cases: both starting to edit a new field, or switching between fields
    setIsEditing(true);
    setEditedValue(committedEditedValue);
    setIsDraftActive(true);
    if (setSourcesFieldPath) {
      setSourcesFieldPath(path);
    }
  };
  const handleFieldHover = (e: React.MouseEvent<any>) => {
    if (setSourcesFieldPath) {
      const target = e.target as HTMLElement;
      // Don't trigger if we're interacting with popover/calendar components
      if (
        !target.closest("[data-radix-popper-content-wrapper]") &&
        !target.closest('[role="button"]')
      ) {
        setSourcesFieldPath(path);
      }
    }
  };
  const formFieldPrefix = formFieldIdPrefix ?? "form-field";
  const isVerified = Boolean(getNestedValue(validationFlags, path));
  const functionStylingClass =
    isFunctionField && !isVerified ? getFunctionFieldStyling(fieldValue) : "";
  // Check if this field should be highlighted (for HIL review attention)
  // Only highlight exact matches or if this is a child of a highlighted parent
  // Don't highlight parents when children are highlighted (causes ugly nested rings)
  // Supports wildcard .* to match all array indices (form paths use dot notation like .0., .1.)
  const highlightedFields: string[] = (config as any)?.highlightedFields || [];
  const fieldIndicationMap: Map<string, string> | undefined = (config as any)
    ?.fieldIndicationMap;

  // Find if this field matches a highlighted pattern and get the indication text
  let matchedHighlightPattern: string | null = null;
  const isHighlightedField = highlightedFields.some((hp) => {
    // Convert highlighted pattern to match form paths (which use dot notation for arrays)
    // e.g., "invoice.line_items.*.name" should match "invoice.line_items.0.name"
    const regexPattern = hp
      .replace(/\.\*/g, ".__WILDCARD__") // Temporarily replace wildcard
      .replace(/\[(\d+)\]/g, ".$1") // Convert [0] to .0
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
      .replace(/__WILDCARD__/g, "\\d+"); // Convert wildcard to match any number
    const regex = new RegExp(`^${regexPattern}($|\\.)`);
    const matches = regex.test(path) || regex.test(path + ".");
    if (matches) {
      matchedHighlightPattern = hp;
    }
    return matches;
  });

  // Get indication text for this highlighted field
  const indicationText =
    matchedHighlightPattern && fieldIndicationMap?.get(matchedHighlightPattern);
  const highlightedFieldClass = isHighlightedField
    ? "ring-2 ring-warning bg-warning/10 rounded-lg p-2 mb-2"
    : "";
  return (
    <div
      id={`${formFieldPrefix}-${path.split(".").join("-")}`}
      className={cn("group space-y-2", highlightedFieldClass)}
      key={path}
    >
      {/* Indication text for highlighted fields */}
      {isHighlightedField && indicationText && (
        <div className="flex flex-col gap-1 rounded border border-warning bg-warning/20 px-2 py-1.5 text-xs text-warning-foreground">
          <div className="flex items-center gap-1.5">
            <MessageSquareWarning className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{indicationText}</span>
          </div>
        </div>
      )}
      <FormField
        control={form.control}
        name={path}
        render={({ field: formField }) =>
          inputType === "checkbox" ? (
            <FormItem className="my-2 flex items-center space-y-0">
              <FormControl>
                <StyledCheckbox
                  size={size}
                  uncertainty={getNestedValue(likelihoods, path)}
                  variant={scalarValueDisplay}
                  scalarValueType={scalarValueType}
                  className={cn(
                    className,
                    highlightClasses(
                      isVerified,
                      isComputedField,
                      "ring",
                      fieldType === "boolean",
                      activeEditedValue?.toLowerCase() === "true",
                    ),
                    functionStylingClass,
                  )}
                  onCheckedChange={(checked) => {
                    handleFormDataChange(formField, checked);
                    setEditedValue(undefined);
                    setIsDraftActive(false);
                  }}
                  checked={activeEditedValue?.toLowerCase() === "true"}
                  disabled={isFieldDisabled}
                />
              </FormControl>
              {titlePosition != "none" && (
                <div
                  className={cn(
                    className,
                    "outline- ml-2 flex min-h-0 flex-1 border-none bg-transparent text-left text-xs shadow-none",
                  )}
                >
                  <LabelContent />
                </div>
              )}
            </FormItem>
          ) : (
            <FormItem className="flex min-h-0 flex-1 flex-col">
              {isStreaming && isUndefined(getNestedValue(formData, path))
                ? titlePosition != "none" && (
                    <FormLabel
                      className={cn(
                        className,
                        "mt-4 flex border-none bg-transparent text-left shadow-none outline-transparent hover:bg-transparent",
                      )}
                    >
                      <Skeleton
                        className={
                          "h-4 w-[30%] animate-pulse rounded-md border-none bg-muted outline-transparent outline-none"
                        }
                      />
                    </FormLabel>
                  )
                : titlePosition != "none" && (
                    <div
                      className={cn(
                        className,
                        "mt-4 flex border-none bg-transparent text-left shadow-none outline-transparent hover:bg-transparent",
                      )}
                    >
                      <LabelContent />
                    </div>
                  )}
              <FormControl
                className="flex min-h-0 flex-1"
                onMouseEnter={handleFieldHover}
                onMouseOver={handleFieldHover}
                onClick={handleFieldClick}
              >
                {isProcessing && !isStreaming ? (
                  <Skeleton
                    className={cn(
                      size === "sm" ? "h-[32px]" : "h-[42px]",
                      "flex animate-pulse rounded-md border-none bg-muted outline-none",
                    )}
                  />
                ) : fieldType === "enum" && enumOptions ? (
                  isStreaming && isUndefined(getNestedValue(formData, path)) ? (
                    <Skeleton
                      className={cn(
                        size === "sm" ? "h-[32px]" : "h-[42px]",
                        "flex animate-pulse rounded-md border-none bg-muted outline-none",
                      )}
                    />
                  ) : (
                    <StyledSelect
                      onOpenChange={(open) => {
                        if (open) {
                          setEditedValue(committedEditedValue);
                          setIsDraftActive(true);
                        }
                        setIsPopoverOpen(open);
                        if (!open) {
                          setIsDraftActive(false);
                        }
                      }}
                      size={size}
                      disabled={isFieldDisabled}
                      value={toSelectValue(activeEditedValue)}
                      onValueChange={(v) => {
                        const newValue = fromSelectValue(v);
                        handleFormDataChange(formField, newValue);
                        setEditedValue(undefined);
                      }}
                      className={cn(
                        className,
                        highlightClasses(
                          isVerified,
                          isComputedField,
                          "border",
                          false,
                        ),
                        functionStylingClass,
                      )}
                      uncertainty={getNestedValue(likelihoods, path)}
                      variant={scalarValueDisplay}
                      scalarValueType={scalarValueType}
                    >
                      {/* optional "none" */}
                      {!isRequired && (
                        <SelectItem value={NULL_OPTION}>{"None"}</SelectItem>
                      )}
                      {enumOptions.map((raw) => {
                        const itemValue = toSelectValue(raw);
                        const label =
                          itemValue === EMPTY_OPTION
                            ? "(Empty)"
                            : itemValue.charAt(0).toUpperCase() +
                              itemValue.slice(1);
                        return (
                          <SelectItem
                            key={itemValue}
                            value={itemValue}
                            className={cn(
                              className,
                              "rounded-none border-none outline-transparent",
                            )}
                          >
                            {label}
                          </SelectItem>
                        );
                      })}
                    </StyledSelect>
                  )
                ) : inputType == "number" ? (
                  isStreaming && isUndefined(getNestedValue(formData, path)) ? (
                    <Skeleton
                      className={cn(
                        size === "sm" ? "h-[32px]" : "h-[42px]",
                        "flex animate-pulse rounded-md border-none bg-muted outline-none",
                      )}
                    />
                  ) : (
                    <StyledInput
                      uncertainty={getNestedValue(likelihoods, path)}
                      variant={scalarValueDisplay}
                      scalarValueType={scalarValueType}
                      inputMode={"numeric"}
                      value={activeEditedValue ?? undefined}
                      type={inputType}
                      disabled={isFieldDisabled}
                      onFocus={() => {
                        setEditedValue(committedEditedValue);
                        setIsDraftActive(true);
                      }}
                      onChange={(e) => {
                        setEditedValue(e.target.value);
                      }}
                      onBlur={() => {
                        if (editedValue === undefined) return;
                        handleFormDataChange(formField, editedValue);
                        setEditedValue(undefined);
                        setIsDraftActive(false);
                      }}
                      className={cn(
                        className,
                        size === "sm" ? "h-[32px] text-sm" : "h-[42px] text-sm",
                        "text-opacity-90",
                        highlightClasses(
                          isVerified,
                          isComputedField,
                          "border",
                          false,
                        ),
                        functionStylingClass,
                      )}
                    />
                  )
                ) : isStreaming &&
                  isUndefined(getNestedValue(formData, path)) ? (
                  <Skeleton
                    className={cn(
                      size === "sm" ? "h-[32px]" : "h-[42px]",
                      "flex animate-pulse rounded-md border-none bg-muted text-destructive/40 outline-none",
                    )}
                  />
                ) : fieldType === "date" ? (
                  isStreaming && isUndefined(getNestedValue(formData, path)) ? (
                    <Skeleton
                      className={cn(
                        size === "sm" ? "h-[32px]" : "h-[42px]",
                        "flex animate-pulse rounded-md border-none bg-muted outline-none",
                      )}
                    />
                  ) : (
                    <StyledDatePicker
                      size={size}
                      disabled={isFieldDisabled}
                      value={safeDate(activeEditedValue || formField.value)}
                      onValueChange={(date) => {
                        let validatedDate: string | null = null;
                        if (date) {
                          // Format as YYYY-MM-DD
                          const year = date.getFullYear();
                          const month = (date.getMonth() + 1)
                            .toString()
                            .padStart(2, "0");
                          const day = date
                            .getDate()
                            .toString()
                            .padStart(2, "0");
                          validatedDate = `${year}-${month}-${day}`;
                        }
                        handleFormDataChange(formField, validatedDate);
                        setEditedValue(undefined);
                        setIsDraftActive(false);
                      }}
                      className={cn(
                        className,
                        highlightClasses(
                          isVerified,
                          isComputedField,
                          "border",
                          false,
                        ),
                        functionStylingClass,
                      )}
                      uncertainty={getNestedValue(likelihoods, path)}
                      variant={scalarValueDisplay}
                      scalarValueType={scalarValueType}
                      placeholder="Pick a date"
                    />
                  )
                ) : fieldType === "datetime" ? (
                  isStreaming && isUndefined(getNestedValue(formData, path)) ? (
                    <Skeleton
                      className={cn(
                        size === "sm" ? "h-[32px]" : "h-[42px]",
                        "flex animate-pulse rounded-md border-none bg-muted outline-none",
                      )}
                    />
                  ) : (
                    <StyledDateTimePicker
                      size={size}
                      scalarValueType={scalarValueType}
                      disabled={isFieldDisabled}
                      value={activeEditedValue ?? undefined}
                      onValueChange={(dateTime) => {
                        handleFormDataChange(formField, dateTime);
                        setEditedValue(undefined);
                        setIsDraftActive(false);
                      }}
                      className={cn(
                        className,
                        highlightClasses(
                          isVerified,
                          isComputedField,
                          "border",
                          false,
                        ),
                        functionStylingClass,
                      )}
                      uncertainty={getNestedValue(likelihoods, path)}
                      variant={scalarValueDisplay}
                    />
                  )
                ) : fieldType === "time" ? (
                  <div className="flex items-center">
                    <StyledInput
                      scalarValueType={scalarValueType}
                      uncertainty={getNestedValue(likelihoods, path)}
                      variant={scalarValueDisplay}
                      type={inputType}
                      disabled={isFieldDisabled}
                      value={activeEditedValue ?? undefined}
                      onFocus={() => {
                        setEditedValue(committedEditedValue);
                        setIsDraftActive(true);
                      }}
                      onChange={(e) => {
                        setEditedValue(e.target.value);
                      }}
                      onBlur={() => {
                        if (editedValue === undefined) return;
                        handleFormDataChange(formField, editedValue);
                        setEditedValue(undefined);
                        setIsDraftActive(false);
                      }}
                      className={cn(
                        className,
                        size === "sm" ? "h-[32px] text-sm" : "h-[42px] text-sm",
                        "text-opacity-90",
                        highlightClasses(
                          isVerified,
                          isComputedField,
                          "border",
                          false,
                        ),
                        functionStylingClass,
                      )}
                      style={{
                        WebkitAppearance: "none",
                      }}
                      multiline={isMultiline}
                    />
                  </div>
                ) : (
                  <StyledTextAreaInput
                    scalarValueType={scalarValueType}
                    uncertainty={getNestedValue(likelihoods, path)}
                    variant={scalarValueDisplay}
                    disabled={isFieldDisabled}
                    value={activeEditedValue ?? undefined}
                    onFocus={() => {
                      setEditedValue(committedEditedValue);
                      setIsDraftActive(true);
                    }}
                    onChange={(e) => {
                      setEditedValue(e.target.value);
                    }}
                    onBlur={() => {
                      if (editedValue === undefined) return;
                      handleFormDataChange(formField, editedValue);
                      setEditedValue(undefined);
                      setIsDraftActive(false);
                    }}
                    className={cn(
                      className,
                      size === "sm" ? "h-[32px] text-sm" : "h-[42px] text-sm",
                      "text-opacity-90",
                      highlightClasses(
                        isVerified,
                        isComputedField,
                        "border",
                        false,
                      ),
                      functionStylingClass,
                    )}
                    style={{
                      WebkitAppearance: "none",
                    }}
                  />
                )}
              </FormControl>
              <FormMessage
                className={cn(
                  className,
                  "mt-4 flex border-none bg-transparent text-left text-xs text-destructive shadow-none hover:bg-transparent",
                )}
              />
            </FormItem>
          )
        }
      />
    </div>
  );
};

interface ObjectRendererProps {
  path: string;
  className?: string;
  isArrayItem?: boolean;
  isLoneObject?: boolean;
}

const ObjectRenderer: React.FC<ObjectRendererProps> = ({
  path,
  className,
  isLoneObject = false,
  isArrayItem = false,
}) => {
  const { schema, form, setLikelihoods, size, disabled, isStreaming, config } =
    useUiFormContext();
  const subschema = getFieldSchema(schema, path);

  // NEW: Use unwrapSchema for proper type detection
  let { schema: effectiveSchema, nullable: isNullable } = unwrapSchema(
    subschema,
    schema,
  );

  const label = path.split(".").pop() || "";

  const showLabel = !!label && !isArrayItem && path !== "";

  const currentValue = form.getValues(path);

  const handleCreateObject = () => {
    const newObject = createEmptyObject(effectiveSchema);
    form.setValue(path, newObject);

    // Set likelihoods to 1 for all fields in the new object
    const setLikelihoodsForObject = (obj: any, basePath: string) => {
      Object.keys(obj).forEach((key) => {
        const fullPath = basePath ? `${basePath}.${key}` : key;
        if (obj[key] !== null && typeof obj[key] === "object") {
          setLikelihoodsForObject(obj[key], fullPath);
        } else {
          setLikelihoods((prev: Record<string, any>) => {
            const newLikelihoods = { ...prev };
            set(newLikelihoods, fullPath, 1);
            return newLikelihoods;
          });
        }
      });
    };

    setLikelihoodsForObject(newObject, path);
  };

  const handleDeleteObject = () => {
    form.setValue(path, null);
  };

  if (isNullable && currentValue === null) {
    return (
      <div className="mt-2 flex">
        <Button
          size={size}
          className={cn(className, "px-2")}
          type="button"
          variant="outline"
          onClick={handleCreateObject}
          disabled={disabled || isStreaming}
        >
          <Plus className="mr-2 size-5" />
          <span className="">{label}</span>
        </Button>
      </div>
    );
  }

  const properties = effectiveSchema.properties || {};

  return (
    <div
      className={cn(
        "space-y-4",
        isArrayItem || isLoneObject
          ? "bg-background/3 rounded-md border-none pt-1 pb-3 shadow-none outline-transparent"
          : "",
      )}
      key={path}
    >
      {showLabel && (
        <div className="mx-auto flex items-center justify-center gap-2 pt-1">
          <FormLabel
            className={cn(
              className,
              "mb-0 flex justify-center border-none bg-transparent text-base font-medium shadow-none outline-transparent hover:bg-transparent",
            )}
          >
            {label}
          </FormLabel>
        </div>
      )}

      {Object.keys(properties).map((prop) => {
        const propSchema = properties[prop];

        // NEW: Use unwrapSchema for proper property type detection
        const { schema: resolvedPropSchema } = unwrapSchema(propSchema, schema);
        const resolvedPropType = resolvedPropSchema?.type;
        const isObjectType =
          resolvedPropType === "object" ||
          (Array.isArray(resolvedPropType) &&
            resolvedPropType.includes("object"));
        const isArrayType =
          resolvedPropType === "array" ||
          (Array.isArray(resolvedPropType) &&
            resolvedPropType.includes("array"));

        const propType =
          resolvedPropType ||
          (resolvedPropSchema?.enum
            ? "enum"
            : resolvedPropSchema?.properties
              ? "object"
              : resolvedPropSchema?.items
                ? "array"
                : "string");

        if (
          process.env.NODE_ENV !== "production" &&
          (propType === "array" || resolvedPropSchema?.items) &&
          (!resolvedPropSchema ||
            resolvedPropSchema.items === undefined ||
            resolvedPropSchema.items === null ||
            Array.isArray(resolvedPropSchema.items))
        ) {
          const fieldPath = path ? `${path}.${prop}` : prop;
          const details = {
            parentPath: path,
            prop,
            fieldPath,
            resolvedPropSchemaType: resolvedPropSchema?.type ?? null,
            resolvedPropSchemaKeys:
              resolvedPropSchema && typeof resolvedPropSchema === "object"
                ? Object.keys(
                    resolvedPropSchema as Record<string, unknown>,
                  ).slice(0, 25)
                : [],
            itemsType:
              resolvedPropSchema?.items === null
                ? "null"
                : Array.isArray(resolvedPropSchema?.items)
                  ? "array"
                  : typeof resolvedPropSchema?.items,
            isComputedField: Boolean(
              (resolvedPropSchema as Record<string, unknown> | null)?.[
                "X-ComputedField"
              ],
            ),
          };
          console.warn(
            `[UiForm][ObjectRenderer] Selecting ArrayRenderer with suspicious schema :: ${JSON.stringify(details)}`,
          );
        }

        if (
          isObjectType ||
          (!resolvedPropType && resolvedPropSchema?.properties)
        ) {
          return (
            <ObjectRenderer
              key={prop}
              path={path ? `${path}.${prop}` : prop}
              className={className}
              isLoneObject={true}
            />
          );
        } else if (
          isArrayType ||
          (!resolvedPropType && resolvedPropSchema?.items)
        ) {
          return (
            <ArrayRenderer
              key={prop}
              path={path ? `${path}.${prop}` : prop}
              className={className}
            />
          );
        } else {
          return (
            <PrimitiveRenderer
              key={prop}
              path={path ? `${path}.${prop}` : prop}
              className={className}
            />
          );
        }
      })}

      {isNullable && !disabled && (
        <Button
          size={size}
          variant="outline"
          type="button"
          onClick={handleDeleteObject}
          className={cn(className, "mx-auto mt-12 flex justify-center")}
          disabled={disabled || isStreaming}
        >
          <Trash className="h-4 w-4" />
          {"Delete"}
        </Button>
      )}
    </div>
  );
};

type TitlePosition = "row" | "object" | "none";

interface DynamicFormProps {
  className?: string;
}

function findErrors(
  errors: any,
  path: string[] = [],
): { path: string[]; error: any }[] {
  if (errors.message) {
    return [{ path, error: errors }];
  }
  return Object.entries(errors).flatMap(([key, value]) =>
    findErrors(value, [...path, key]),
  );
}

export const DynamicForm: React.FC<DynamicFormProps> = ({ className }) => {
  const {
    showSubmit,
    schema,
    config,
    onSubmit,
    form,
    isProcessing,
    isStreaming,
    size,
    disabled,
  } = useUiFormContext();
  const formData = form.getValues();

  return (
    <Form {...form}>
      <form
        className="flex h-full w-full flex-col"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <ObjectRenderer className={className} path="" />

        {Object.keys(form.formState.errors).length > 0 &&
          config?.showErrors === true && (
            <div className="mt-6 font-light">
              <p className="mb-2 text-sm font-medium text-destructive">
                {"Please fix the following errors:"}
              </p>
              {findErrors(form.formState.errors).map(({ path, error }) => {
                const translatedError = error.message;

                return (
                  <div
                    key={path.join(".")}
                    className="items-end justify-end text-xs"
                  >
                    <TriangleAlert
                      size={16}
                      className="mr-1 inline-block text-destructive"
                    />
                    <span className="">{path.join(" > ")}</span>
                    <span className="ml-1 text-destructive">{translatedError}</span>
                  </div>
                );
              })}
            </div>
          )}
        {/* <Button
                    variant="outline"
                    className={cn(className, " mt-12 min-w-[200px] mx-auto flex justify-center ")}
                    type='submit'
                    size={size}
                    disabled={isStreaming || isProcessing}
                >*/}

        {showSubmit &&
          !disabled &&
          schema.properties &&
          Object.keys(schema.properties).length > 0 && (
            <Button
              variant="default"
              className={cn(
                className,
                "bg-primary text-primary-foreground mx-auto mt-12 flex min-w-[200px] justify-center",
              )}
              type="submit"
              size={size}
              disabled={
                isStreaming ||
                isProcessing ||
                Object.keys(form.formState.errors).length > 0
              }
            >
              {config?.submitText || "Submit"}
            </Button>
          )}

        {!(schema.properties && Object.keys(schema.properties).length > 0) && (
          <div className="mx-auto flex min-w-[200px] justify-center">
            <span className="text-sm text-muted-foreground">
              Create a schema to get started
            </span>
          </div>
        )}
      </form>
    </Form>
  );
};

/*
--------------------------------
--------------------------------
--------------------------------
FORM CONTAINER
--------------------------------
--------------------------------
--------------------------------
*/

interface FormSkeletonProps {
  className?: string;
  numberOfFields?: number;
}

export const FormSkeleton: React.FC<FormSkeletonProps> = ({
  className,
  numberOfFields = 10,
}) => {
  return (
    <div className={cn("space-y-4")}>
      {Array.from({ length: numberOfFields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton
            className={cn(
              className,
              "h-4 w-[30%] animate-pulse rounded-md border-none bg-muted outline-transparent outline-none",
            )}
          />
          <Skeleton
            className={cn(
              className,
              "h-10 w-full animate-pulse rounded-md border-none bg-muted outline-transparent outline-none",
            )}
          />
        </div>
      ))}
    </div>
  );
};

export const UiFormContext = createContext<UiFormContextValue | undefined>(
  undefined,
);

export const useUiFormContext = () => {
  const context = useContext(UiFormContext);
  if (!context) {
    throw new Error(
      "useUiFormContext must be used within a UiFormContextProvider",
    );
  }
  return context;
};

export const UiFormContextProviderRaw: React.FC<{
  containerProps: UiFormProps;
  children?: React.ReactNode;
}> = ({ containerProps, children }) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const {
    schema,
    setSchema,
    onSubmit,
    form,
    config,
    variant,
    isStreaming,
    size,
    isProcessing,
    setSourcesFieldPath,
    likelihoods,
    setLikelihoods,
    scalarValueDisplay,
    scalarValueType,
    disabled,
    titlePosition,
    showSubmit,
    propertyEditorMode,
    showPropertyEditorPencil,
    validationFlags,
    setValidationFlags,
    showVerifiedProperty,
    projectId,
    formFieldIdPrefix,
  } = containerProps;

  const value: UiFormContextValue = {
    showSubmit: showSubmit ?? true,
    schema,
    setSchema,
    form,
    isStreaming,
    isProcessing,
    onSubmit,
    config,
    variant,
    size,
    likelihoods,
    setLikelihoods,
    scalarValueDisplay,
    scalarValueType,
    disabled,
    titlePosition,
    setSourcesFieldPath,
    isEditing,
    setIsEditing,
    propertyEditorMode,
    showPropertyEditorPencil,
    validationFlags,
    setValidationFlags,
    showVerifiedProperty,
    projectId,
    formFieldIdPrefix,
  };
  return (
    <UiFormContext.Provider value={value}>{children}</UiFormContext.Provider>
  );
};

export const UiFormContextProvider = React.memo(UiFormContextProviderRaw);

export const UiFormContent = ({
  className,
}: {
  className?: string;
}): JSX.Element => {
  const context = useUiFormContext();
  const { schema, isProcessing, isStreaming } = context;
  const expandedSchema = useMemo(
    () => expandRefs(JSON.parse(JSON.stringify(schema ?? {}))),
    [schema],
  );
  const expandedContext = useMemo(
    () => ({
      ...context,
      schema: expandedSchema,
    }),
    [context, expandedSchema],
  );

  if (isProcessing && !isStreaming) {
    return <FormSkeleton />;
  }

  return (
    <UiFormContext.Provider value={expandedContext}>
      <DynamicForm className={className} />
    </UiFormContext.Provider>
  );
};

export const UiForm = (
  containerProps: UiFormProps & { children?: React.ReactNode },
): JSX.Element => {
  const { className, children } = containerProps;
  return (
    <UiFormContextProvider containerProps={containerProps}>
      <div className={cn("gap-4", className)}>{children}</div>
    </UiFormContextProvider>
  );
};

// Add this utility function near the top after the imports
export const safeDate = (s?: string | null): Date | null => {
  if (!s || s === "Undefined") return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
};

/**  Robustly digs a dotted path out of an object / array */
export const getValueByPath = (
  obj: Record<string, any> | any[],
  path: string,
): any => {
  return path.split(".").reduce((acc: any, seg: string) => {
    if (acc == null) return undefined;
    if (seg === "*") return acc; // keep array for caller
    if (/^\d+$/.test(seg)) return acc[Number(seg)];
    return acc[seg];
  }, obj);
};
