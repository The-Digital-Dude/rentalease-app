import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  Image,
  Alert,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from "../contexts/ThemeContext";
import SignatureCapture from './SignatureCapture';
import type {
  InspectionTemplate,
  InspectionField,
  InspectionMediaUpload,
  InspectionTableColumn,
} from "../services/jobs";
import { getMediaStorageKey } from "../services/jobs";

export type InspectionFormValues = Record<string, any>;

const resolveFieldLabel = (field: InspectionField): string => {
  const fromQuestion = field.question?.trim();
  if (fromQuestion) {
    return fromQuestion;
  }
  const fromLabel = field.label?.trim();
  if (fromLabel) {
    return fromLabel;
  }
  return field.id;
};

interface DatePickerFieldProps {
  value: string | null | undefined;
  onChange: (date: string) => void;
  placeholder: string;
  editable: boolean;
  theme: any;
}

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  placeholder,
  editable,
  theme,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (value) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    return new Date();
  });

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (date && event.type !== 'dismissed') {
        setSelectedDate(date);
        const formattedDate = date.toISOString().split('T')[0];
        onChange(formattedDate);
      }
    } else {
      // On iOS, update immediately as user scrolls
      if (date) {
        setSelectedDate(date);
        const formattedDate = date.toISOString().split('T')[0];
        onChange(formattedDate);
      }
    }
  };

  const handleIOSConfirm = () => {
    setShowPicker(false);
  };

  const handleIOSCancel = () => {
    setShowPicker(false);
    // Reset to original date if cancelled
    if (value) {
      const originalDate = new Date(value);
      if (!isNaN(originalDate.getTime())) {
        setSelectedDate(originalDate);
      }
    }
  };

  const handlePress = () => {
    if (editable) {
      setShowPicker(true);
    }
  };

  const formatDisplayDate = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString();
    } catch {
      return "";
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.datePickerButton,
          {
            borderColor: theme.border,
            backgroundColor: editable ? theme.surface || theme.card : theme.textTertiary
          }
        ]}
        onPress={handlePress}
        disabled={!editable}
      >
        <Text
          style={[
            styles.datePickerText,
            {
              color: value ? theme.text : theme.placeholder
            }
          ]}
        >
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
        <MaterialCommunityIcons
          name="calendar"
          size={20}
          color={theme.textSecondary}
        />
      </TouchableOpacity>

      {showPicker && Platform.OS === 'ios' && (
        <View style={styles.iosPickerContainer}>
          <View style={[styles.iosPickerHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={handleIOSCancel} style={styles.iosPickerButton}>
              <Text style={[styles.iosPickerButtonText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleIOSConfirm} style={styles.iosPickerButton}>
              <Text style={[styles.iosPickerButtonText, { color: theme.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            onChange={handleDateChange}
            style={styles.iosDatePicker}
          />
        </View>
      )}

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </View>
  );
};

interface InspectionFormProps {
  template: InspectionTemplate;
  values: InspectionFormValues;
  mediaByField: Record<string, InspectionMediaUpload[]>;
  onChange: (
    sectionId: string,
    fieldId: string,
    value: any,
    itemIndex?: number
  ) => void;
  onAddMedia: (
    sectionId: string,
    fieldId: string,
    media: InspectionMediaUpload,
    itemIndex?: number
  ) => void;
  onRemoveMedia: (
    sectionId: string,
    fieldId: string,
    index: number,
    itemIndex?: number
  ) => void;
  onAddRepeatableItem: (sectionId: string) => void;
  onRemoveRepeatableItem: (sectionId: string, itemIndex: number) => void;
  notes: string;
  onNotesChange: (val: string) => void;
  editable?: boolean;
}

const InspectionForm: React.FC<InspectionFormProps> = ({
  template,
  values,
  mediaByField,
  onChange,
  onAddMedia,
  onRemoveMedia,
  onAddRepeatableItem,
  onRemoveRepeatableItem,
  notes,
  onNotesChange,
  editable = true,
}) => {
  const { theme } = useTheme();
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [currentSignatureField, setCurrentSignatureField] = useState<{
    sectionId: string;
    fieldId: string;
    itemIndex?: number;
  } | null>(null);

  const getScopedValues = (sectionId: string, itemIndex?: number) => {
    const sectionValues = values[sectionId];
    if (itemIndex === undefined) {
      return sectionValues || {};
    }
    if (!Array.isArray(sectionValues)) {
      return {};
    }
    return sectionValues[itemIndex] || {};
  };

  const isFieldVisible = (
    field: InspectionField,
    scopeValues: Record<string, any>
  ) => {
    const visibleWhen = field.metadata?.visibleWhen;
    if (!visibleWhen) {
      return true;
    }

    const dependencyValue = scopeValues?.[visibleWhen.fieldId];
    if (visibleWhen.equals !== undefined) {
      return dependencyValue === visibleWhen.equals;
    }
    return true;
  };

  const isFieldReadOnly = (field: InspectionField) =>
    !editable || !!field.metadata?.readOnly || !!field.metadata?.systemCalculated;

  const getReadOnlyValue = (field: InspectionField, value: any) => {
    if (value === null || value === undefined || value === "") {
      return field.metadata?.systemCalculated
        ? "Calculated on submission"
        : "No value";
    }
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    const optionLabel = field.options?.find((option) => option.value === value)?.label;
    return optionLabel || String(value);
  };

  const handlePickImage = async (
    sectionId: string,
    field: InspectionField,
    currentCount: number,
    itemIndex?: number
  ) => {
    console.log("[InspectionForm] handlePickImage called for field:", field.id, "currentCount:", currentCount);

    if (!editable) {
      console.log("[InspectionForm] Form not editable, returning");
      return;
    }

    console.log("[InspectionForm] Showing action sheet for photo selection");

    // Show action sheet to choose camera or photo library
    Alert.alert(
      "Add Photo",
      "Choose photo source",
      [
        {
          text: "Camera",
          onPress: () => {
            console.log("[InspectionForm] Camera option selected");
            handleCameraLaunch(sectionId, field, itemIndex);
          },
        },
        {
          text: "Photo Library",
          onPress: () => {
            console.log("[InspectionForm] Photo Library option selected");
            handlePhotoLibraryLaunch(sectionId, field, itemIndex);
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            console.log("[InspectionForm] Photo selection canceled");
          },
        },
      ]
    );
  };

  const handleCameraLaunch = async (
    sectionId: string,
    field: InspectionField,
    itemIndex?: number
  ) => {
    try {
      console.log("[InspectionForm] Camera launch initiated for field:", field.id);

      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      console.log("[InspectionForm] Camera permission result:", cameraPermission);

      if (!cameraPermission.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Camera permission is needed to take inspection photos."
        );
        return;
      }

      console.log("[InspectionForm] Launching camera...");
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      console.log("[InspectionForm] Camera result:", result);

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const media: InspectionMediaUpload = {
          uri: asset.uri,
          name:
            asset.fileName ||
            `${field.id}-${Date.now()}.${asset.mimeType?.split("/").pop() || "jpg"}`,
          type: asset.mimeType || "image/jpeg",
          size: asset.fileSize,
        };
        console.log("[InspectionForm] Adding media:", media);
        onAddMedia(sectionId, field.id, media, itemIndex);
      }
    } catch (error) {
      console.error("[InspectionForm] Camera error:", error);
      Alert.alert("Camera Error", "Failed to access camera. Please try again.");
    }
  };

  const handlePhotoLibraryLaunch = async (
    sectionId: string,
    field: InspectionField,
    itemIndex?: number
  ) => {
    try {
      console.log("[InspectionForm] Photo library launch initiated for field:", field.id);

      // Request media library permissions
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log("[InspectionForm] Photo library permission result:", permission);

      if (!permission.granted) {
        Alert.alert(
          "Photo Library Permission Required",
          "Photo library permission is needed to attach inspection photos."
        );
        return;
      }

      console.log("[InspectionForm] Launching photo library...");
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      console.log("[InspectionForm] Photo library result:", result);

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const media: InspectionMediaUpload = {
          uri: asset.uri,
          name:
            asset.fileName ||
            `${field.id}-${Date.now()}.${asset.mimeType?.split("/").pop() || "jpg"}`,
          type: asset.mimeType || "image/jpeg",
          size: asset.fileSize,
        };
        console.log("[InspectionForm] Adding media:", media);
        onAddMedia(sectionId, field.id, media, itemIndex);
      }
    } catch (error) {
      console.error("[InspectionForm] Photo library error:", error);
      Alert.alert("Photo Library Error", "Failed to access photo library. Please try again.");
    }
  };

  const toggleBoolean = (
    sectionId: string,
    fieldId: string,
    current: boolean,
    itemIndex?: number
  ) => {
    onChange(sectionId, fieldId, !current, itemIndex);
  };

  const toggleMultiSelect = (
    sectionId: string,
    field: InspectionField,
    optionValue: string,
    itemIndex?: number
  ) => {
    const current = getScopedValues(sectionId, itemIndex)?.[field.id] || [];
    const exists = current.includes(optionValue);
    const nextValue = exists
      ? current.filter((val: string) => val !== optionValue)
      : [...current, optionValue];
    onChange(sectionId, field.id, nextValue, itemIndex);
  };

  const handleOpenSignature = (
    sectionId: string,
    fieldId: string,
    itemIndex?: number
  ) => {
    if (!editable) return;
    setCurrentSignatureField({ sectionId, fieldId, itemIndex });
    setSignatureModalVisible(true);
  };

  const handleSaveSignature = (base64Signature: string) => {
    if (currentSignatureField) {
      onChange(
        currentSignatureField.sectionId,
        currentSignatureField.fieldId,
        base64Signature,
        currentSignatureField.itemIndex
      );
    }
    setSignatureModalVisible(false);
    setCurrentSignatureField(null);
  };

  const handleClearSignature = (
    sectionId: string,
    fieldId: string,
    itemIndex?: number
  ) => {
    if (!editable) return;
    onChange(sectionId, fieldId, null, itemIndex);
  };

  const renderTableField = (sectionId: string, field: InspectionField) => {
    const columns: InspectionTableColumn[] = field.columns || field.metadata?.columns || [];
    const sectionValues = values[sectionId] || {};
    const rows: Array<Record<string, any>> = Array.isArray(sectionValues[field.id])
      ? sectionValues[field.id]
      : [];

    const handleRowChange = (
      rowIndex: number,
      columnId: string,
      value: any
    ) => {
      const updatedRows = rows.map((row, index) =>
        index === rowIndex ? { ...row, [columnId]: value } : row
      );
      onChange(sectionId, field.id, updatedRows);
    };

    const handleAddRow = () => {
      const newRow: Record<string, any> = {};
      columns.forEach((column) => {
        newRow[column.id] = "";
      });
      onChange(sectionId, field.id, [...rows, newRow]);
    };

    const handleRemoveRow = (rowIndex: number) => {
      const updatedRows = rows.filter((_, index) => index !== rowIndex);
      onChange(sectionId, field.id, updatedRows);
    };

    const renderColumnInput = (
      column: InspectionTableColumn,
      rowIndex: number,
      rowValue: Record<string, any>
    ) => {
      const value = rowValue[column.id] ?? "";
      const commonInputStyle = [
        styles.tableInput,
        {
          borderColor: theme.border,
          color: theme.text,
        },
      ];
      const baseTextInputProps = {
        editable,
        placeholderTextColor: theme.placeholder,
      } as const;

      switch (column.type) {
        case "number":
          return (
            <TextInput
              {...baseTextInputProps}
              style={commonInputStyle}
              keyboardType="numeric"
              placeholder={column.placeholder || "0"}
              value={value !== undefined && value !== null ? String(value) : ""}
              onChangeText={(text) => {
                const numeric = text === "" ? "" : text.replace(/[^0-9.-]/g, "");
                handleRowChange(rowIndex, column.id, numeric);
              }}
            />
          );
        case "select":
          return (
            <View style={styles.tableSelectRow}>
              {(column.options || []).map((option) => {
                const isSelected = value === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionChip,
                      styles.tableOptionChip,
                      {
                        borderColor: isSelected ? theme.primary : theme.border,
                        backgroundColor: isSelected ? theme.primary : theme.card,
                      },
                    ]}
                    onPress={() =>
                      editable && handleRowChange(rowIndex, column.id, option.value)
                    }
                    disabled={!editable}
                  >
                    <Text
                      style={{
                        color: isSelected ? "#fff" : theme.text,
                        fontWeight: isSelected ? "600" : "500",
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        case "date":
          return (
            <DatePickerField
              value={value || null}
              onChange={(date) => handleRowChange(rowIndex, column.id, date)}
              placeholder={column.placeholder || "Select date"}
              editable={editable}
              theme={theme}
            />
          );
        case "textarea":
          return (
            <TextInput
              {...baseTextInputProps}
              style={[...commonInputStyle, styles.tableTextarea]}
              placeholder={column.placeholder || "Enter details"}
              value={value ?? ""}
              multiline
              numberOfLines={3}
              onChangeText={(text) => handleRowChange(rowIndex, column.id, text)}
            />
          );
        case "text":
        default:
          return (
            <TextInput
              {...baseTextInputProps}
              style={commonInputStyle}
              placeholder={column.placeholder || "Enter value"}
              value={value ?? ""}
              onChangeText={(text) => handleRowChange(rowIndex, column.id, text)}
            />
          );
      }
    };

    return (
      <View style={styles.tableContainer}>
        {rows.length === 0 ? (
          <Text style={[styles.tableEmpty, { color: theme.textSecondary }]}>
            {editable
              ? "No records yet. Add the first entry to begin recording information."
              : "No records provided."}
          </Text>
        ) : null}

        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={[styles.tableRow, { borderColor: theme.border }]}> 
            <View style={styles.tableRowHeader}>
              <Text style={[styles.tableRowTitle, { color: theme.text }]}>
                {`${resolveFieldLabel(field)} #${rowIndex + 1}`}
              </Text>
              {editable && (
                <TouchableOpacity
                  onPress={() => handleRemoveRow(rowIndex)}
                  style={styles.tableRemoveButton}
                >
                  <MaterialCommunityIcons
                    name="delete"
                    size={18}
                    color={theme.error}
                  />
                </TouchableOpacity>
              )}
            </View>

            {columns.map((column) => (
              <View key={column.id} style={styles.tableColumn}>
                <Text style={[styles.tableColumnLabel, { color: theme.textSecondary }]}>
                  {column.label}
                  {column.required ? " *" : ""}
                </Text>
                {renderColumnInput(column, rowIndex, row)}
              </View>
            ))}
          </View>
        ))}

        {editable && (
          <TouchableOpacity
            style={[styles.tableAddButton, { borderColor: theme.primary }]}
            onPress={handleAddRow}
          >
            <MaterialCommunityIcons
              name="plus"
              size={20}
              color={theme.primary}
            />
            <Text style={[styles.tableAddButtonText, { color: theme.primary }]}>
              {`Add ${resolveFieldLabel(field)}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderField = (
    sectionId: string,
    field: InspectionField,
    itemIndex?: number
  ) => {
    const sectionValues = getScopedValues(sectionId, itemIndex);
    const fieldValue = sectionValues[field.id];
    const mediaKey = getMediaStorageKey(sectionId, field.id, itemIndex);
    const mediaForField = mediaByField[mediaKey] || [];
    const readOnly = isFieldReadOnly(field);

    if (!isFieldVisible(field, sectionValues)) {
      return null;
    }

    if (readOnly && field.type !== "signature") {
      return (
        <View style={[styles.readOnlyContainer, { borderColor: theme.border }]}>
          <Text style={[styles.readOnlyText, { color: theme.textSecondary }]}>
            {getReadOnlyValue(field, fieldValue)}
          </Text>
        </View>
      );
    }

    switch (field.type) {
      case "text":
      case "textarea":
        return (
          <TextInput
            style={[styles.textInput, { borderColor: theme.border, color: theme.text }]}
            value={fieldValue ?? ""}
            onChangeText={(text) => onChange(sectionId, field.id, text, itemIndex)}
            placeholder={field.placeholder || "Enter value"}
            placeholderTextColor={theme.placeholder}
            multiline={field.type === "textarea"}
            numberOfLines={field.type === "textarea" ? 4 : 1}
            editable={!readOnly}
          />
        );
      case "number":
        return (
          <TextInput
            style={[styles.textInput, { borderColor: theme.border, color: theme.text }]}
            value={fieldValue !== undefined ? String(fieldValue) : ""}
            onChangeText={(text) => {
              const numeric = text === "" ? null : Number(text.replace(/[^0-9.-]/g, ""));
              onChange(
                sectionId,
                field.id,
                isNaN(numeric as number) ? null : numeric,
                itemIndex
              );
            }}
            keyboardType="numeric"
            placeholder={field.placeholder || "0"}
            placeholderTextColor={theme.placeholder}
            editable={!readOnly}
          />
        );
      case "time":
        return (
          <TextInput
            style={[styles.textInput, { borderColor: theme.border, color: theme.text }]}
            value={fieldValue ?? ""}
            onChangeText={(text) => onChange(sectionId, field.id, text, itemIndex)}
            placeholder={field.placeholder || "HH:MM"}
            placeholderTextColor={theme.placeholder}
            keyboardType="numbers-and-punctuation"
            editable={!readOnly}
          />
        );
      case "boolean":
        return (
          <View style={styles.booleanRow}>
            <Switch
              value={!!fieldValue}
              onValueChange={() =>
                toggleBoolean(sectionId, field.id, !!fieldValue, itemIndex)
              }
              trackColor={{ false: theme.textTertiary, true: theme.primary }}
              thumbColor={!!fieldValue ? theme.surface : theme.textSecondary}
              disabled={readOnly}
            />
            <Text style={[styles.booleanLabel, { color: theme.textSecondary }]}>
              {fieldValue ? "Yes" : "No"}
            </Text>
          </View>
        );
      case "select":
        return (
          <View style={styles.optionList}>
            {(field.options || []).map((option) => {
              const isSelected = fieldValue === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionChip,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected
                        ? theme.primary
                        : theme.card,
                    },
                  ]}
                  onPress={() =>
                    !readOnly && onChange(sectionId, field.id, option.value, itemIndex)
                  }
                  disabled={readOnly}
                >
                  <Text
                    style={{
                      color: isSelected ? "#fff" : theme.text,
                      fontWeight: isSelected ? "600" : "500",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      case "multi-select":
        return (
          <View style={styles.optionList}>
            {(field.options || []).map((option) => {
              const selectedValues = fieldValue || [];
              const isSelected = selectedValues.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionChip,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected
                        ? theme.primary
                        : theme.card,
                    },
                  ]}
                  onPress={() =>
                    !readOnly &&
                    toggleMultiSelect(sectionId, field, option.value, itemIndex)
                  }
                  disabled={readOnly}
                >
                  <Text
                    style={{
                      color: isSelected ? "#fff" : theme.text,
                      fontWeight: isSelected ? "600" : "500",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      case "yes-no":
        return (
          <View style={styles.optionList}>
            {[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" }
            ].map((option) => {
              const isSelected = fieldValue === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionChip,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected
                        ? theme.primary
                        : theme.card,
                    },
                  ]}
                  onPress={() =>
                    !readOnly && onChange(sectionId, field.id, option.value, itemIndex)
                  }
                  disabled={readOnly}
                >
                  <Text
                    style={{
                      color: isSelected ? "#fff" : theme.text,
                      fontWeight: isSelected ? "600" : "500",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      case "yes-no-na":
        return (
          <View style={styles.optionList}>
            {[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "na", label: "N/A" }
            ].map((option) => {
              const isSelected = fieldValue === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionChip,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected
                        ? theme.primary
                        : theme.card,
                    },
                  ]}
                  onPress={() =>
                    !readOnly && onChange(sectionId, field.id, option.value, itemIndex)
                  }
                  disabled={readOnly}
                >
                  <Text
                    style={{
                      color: isSelected ? "#fff" : theme.text,
                      fontWeight: isSelected ? "600" : "500",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      case "pass-fail":
        return (
          <View style={styles.optionList}>
            {[
              { value: "pass", label: "Pass" },
              { value: "fail", label: "Fail" }
            ].map((option) => {
              const isSelected = fieldValue === option.value;
              const isPass = option.value === "pass";
              const isFail = option.value === "fail";
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionChip,
                    {
                      borderColor: isSelected
                        ? (isPass ? "#10B981" : isFail ? "#EF4444" : theme.primary)
                        : theme.border,
                      backgroundColor: isSelected
                        ? (isPass ? "#10B981" : isFail ? "#EF4444" : theme.primary)
                        : theme.card,
                    },
                  ]}
                  onPress={() =>
                    !readOnly && onChange(sectionId, field.id, option.value, itemIndex)
                  }
                  disabled={readOnly}
                >
                  <Text
                    style={{
                      color: isSelected ? "#fff" : theme.text,
                      fontWeight: isSelected ? "600" : "500",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      case "date":
        return (
          <DatePickerField
            value={fieldValue}
            onChange={(date) => onChange(sectionId, field.id, date, itemIndex)}
            placeholder={field.placeholder || "Select date"}
            editable={!readOnly}
            theme={theme}
          />
        );
      case "signature":
        return (
          <View style={styles.signatureContainer}>
            <View style={[styles.signatureBox, { borderColor: theme.border }]}> 
              {fieldValue ? (
                <View style={styles.signaturePresent}>
                  <Image
                    source={{ uri: fieldValue }}
                    style={styles.signatureImage}
                    resizeMode="contain"
                  />
                  {!readOnly && (
                    <TouchableOpacity
                      style={[styles.signatureRemoveButton, { backgroundColor: theme.error }]}
                      onPress={() => handleClearSignature(sectionId, field.id, itemIndex)}
                    >
                      <MaterialCommunityIcons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.signatureButton}
                  onPress={() => handleOpenSignature(sectionId, field.id, itemIndex)}
                  disabled={readOnly}
                >
                  <MaterialCommunityIcons
                    name="draw"
                    size={24}
                    color={theme.primary}
                  />
                  <Text style={[styles.signatureButtonText, { color: theme.primary }]}> 
                    Tap to Sign
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {field.helpText && (
              <Text style={[styles.helpText, { color: theme.textSecondary }]}> 
                {field.helpText}
              </Text>
            )}
          </View>
        );
      case "table":
        return renderTableField(sectionId, field);
      case "photo":
      case "photo-multi": {
        const canAdd = true;
        return (
          <View>
            <View style={styles.mediaRow}>
              {mediaForField.map((item, index) => (
                <View key={`${item.uri}-${index}`} style={styles.mediaThumb}>
                  <Image source={{ uri: item.uri }} style={styles.mediaImage} />
                  {!readOnly && (
                    <TouchableOpacity
                      style={styles.mediaRemove}
                      onPress={() => onRemoveMedia(sectionId, field.id, index, itemIndex)}
                    >
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={18}
                        color={theme.error}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {!readOnly && (
                <TouchableOpacity
                  style={[styles.mediaAddButton, { borderColor: theme.border }]}
                  onPress={() =>
                    handlePickImage(sectionId, field, mediaForField.length, itemIndex)
                  }
                  disabled={!canAdd}
                >
                  <MaterialCommunityIcons
                    name="camera-plus"
                    size={24}
                    color={canAdd ? theme.primary : theme.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>
            {field.helpText && (
              <Text style={[styles.helpText, { color: theme.textSecondary }]}>
                {field.helpText}
              </Text>
            )}
          </View>
        );
      }
      case "checkbox": {
        const booleanValue = fieldValue === true || fieldValue === "true";
        return (
          <View style={styles.fieldContainer}>
            <TouchableOpacity
              style={[
                styles.checkboxRow,
                readOnly && styles.disabled
              ]}
              onPress={() =>
                !readOnly && onChange(sectionId, field.id, !booleanValue, itemIndex)
              }
              disabled={readOnly}
            >
              <View style={[
                styles.checkboxContainer,
                { borderColor: theme.border },
                booleanValue && { backgroundColor: theme.primary, borderColor: theme.primary }
              ]}>
                {booleanValue && (
                  <MaterialCommunityIcons
                    name="check"
                    size={16}
                    color="white"
                  />
                )}
              </View>
              <Text style={[
                styles.checkboxLabel,
                { color: theme.text },
                !editable && { color: theme.textSecondary }
              ]}>
                {field.label}
                {field.required && <Text style={{ color: theme.error }}> *</Text>}
              </Text>
            </TouchableOpacity>
            {field.helpText && (
              <Text style={[styles.helpText, { color: theme.textSecondary }]}>
                {field.helpText}
              </Text>
            )}
          </View>
        );
      }
      case "checkbox-group": {
        const groupValue = Array.isArray(fieldValue) ? fieldValue : [];
        return (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              {field.label}
              {field.required && <Text style={{ color: theme.error }}> *</Text>}
            </Text>
            {field.options?.map((option) => {
              const isSelected = groupValue.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.checkboxRow,
                    readOnly && styles.disabled
                  ]}
                  onPress={() => {
                    if (readOnly) return;
                    const newValue = isSelected
                      ? groupValue.filter(v => v !== option.value)
                      : [...groupValue, option.value];
                    onChange(sectionId, field.id, newValue, itemIndex);
                  }}
                  disabled={readOnly}
                >
                  <View style={[
                    styles.checkboxContainer,
                    { borderColor: theme.border },
                    isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }
                  ]}>
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color="white"
                      />
                    )}
                  </View>
                  <Text style={[
                    styles.checkboxLabel,
                    { color: theme.text },
                    readOnly && { color: theme.textSecondary }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {field.helpText && (
              <Text style={[styles.helpText, { color: theme.textSecondary }]}>
                {field.helpText}
              </Text>
            )}
          </View>
        );
      }
      case "radio":
        return (
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}> 
              {field.label}
              {field.required && <Text style={{ color: theme.error }}> *</Text>}
            </Text>
            {field.options?.map((option) => {
              const isSelected = fieldValue === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.radioRow,
                    readOnly && styles.disabled
                  ]}
                  onPress={() =>
                    !readOnly && onChange(sectionId, field.id, option.value, itemIndex)
                  }
                  disabled={readOnly}
                >
                  <View style={[
                    styles.radioContainer,
                    { borderColor: theme.border },
                    isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }
                  ]}>
                    {isSelected && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Text style={[
                    styles.radioLabel,
                    { color: theme.text },
                    readOnly && { color: theme.textSecondary }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {field.helpText && (
              <Text style={[styles.helpText, { color: theme.textSecondary }]}> 
                {field.helpText}
              </Text>
            )}
          </View>
        );
      case "pass-fail-na":
        return (
          <View style={styles.optionList}>
            {[
              { value: "pass", label: "Pass" },
              { value: "fail", label: "Fail" },
              { value: "na", label: "N/A" },
            ].map((option) => {
              const isSelected = fieldValue === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionChip,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected ? theme.primary : theme.card,
                    },
                  ]}
                  onPress={() =>
                    !readOnly && onChange(sectionId, field.id, option.value, itemIndex)
                  }
                  disabled={readOnly}
                >
                  <Text
                    style={{
                      color: isSelected ? "#fff" : theme.text,
                      fontWeight: isSelected ? "600" : "500",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      default:
        return (
          <Text style={[styles.unsupported, { color: theme.textSecondary }]}> 
            {`Field type "${field.type}" is not yet supported on mobile.`}
          </Text>
        );
    }
  };

  return (
    <View>
      {template.sections.map((section) => {
        const renderFieldBlock = (field: InspectionField, itemIndex?: number) => {
          const scopeValues = getScopedValues(section.id, itemIndex);
          if (!isFieldVisible(field, scopeValues)) {
            return null;
          }

          return (
            <View key={`${field.id}-${itemIndex ?? "base"}`} style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  {resolveFieldLabel(field)}
                  {field.required ? " *" : ""}
                </Text>
              </View>
              {field.helpText ? (
                <Text style={[styles.helpText, { color: theme.textSecondary }]}>
                  {field.helpText}
                </Text>
              ) : null}
              {renderField(section.id, field, itemIndex)}
            </View>
          );
        };

        const repeatableItems = Array.isArray(values[section.id]) ? values[section.id] : [];

        return (
          <View
            key={section.id}
            style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
            {section.description ? (
              <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                {section.description}
              </Text>
            ) : null}

            {section.repeatable ? (
              <View style={styles.repeatableSection}>
                {repeatableItems.map((item, itemIndex) => {
                  const summaryFieldId = section.metadata?.summaryFieldId;
                  const summaryValue = summaryFieldId ? item?.[summaryFieldId] : null;
                  const minimumItems = section.minItems || 0;
                  const canRemove = editable && repeatableItems.length > minimumItems;

                  return (
                    <View
                      key={`${section.id}-${itemIndex}`}
                      style={[styles.repeatableCard, { borderColor: theme.border }]}
                    >
                      <View style={styles.repeatableHeader}>
                        <View>
                          <Text style={[styles.repeatableTitle, { color: theme.text }]}>
                            {(section.itemLabel || "Item") + ` ${itemIndex + 1}`}
                          </Text>
                          {summaryValue ? (
                            <Text
                              style={[
                                styles.repeatableSummary,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {String(summaryValue)}
                            </Text>
                          ) : null}
                        </View>
                        {canRemove ? (
                          <TouchableOpacity
                            onPress={() => onRemoveRepeatableItem(section.id, itemIndex)}
                          >
                            <MaterialCommunityIcons
                              name="delete-outline"
                              size={20}
                              color={theme.error}
                            />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      {section.fields.map((field) => renderFieldBlock(field, itemIndex))}
                    </View>
                  );
                })}

                {editable ? (
                  <TouchableOpacity
                    style={[styles.repeatableAddButton, { borderColor: theme.primary }]}
                    onPress={() => onAddRepeatableItem(section.id)}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={18}
                      color={theme.primary}
                    />
                    <Text
                      style={[styles.repeatableAddButtonText, { color: theme.primary }]}
                    >
                      {section.addButtonLabel || `Add ${section.itemLabel || "item"}`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              section.fields.map((field) => renderFieldBlock(field))
            )}
          </View>
        );
      })}

      <View
        style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      >
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Technician Notes</Text>
        <TextInput
          style={[styles.textArea, { borderColor: theme.border, color: theme.text }]}
          placeholder="Add any additional observations"
          placeholderTextColor={theme.placeholder}
          value={notes}
          onChangeText={onNotesChange}
          multiline
          numberOfLines={5}
          editable={editable}
        />
      </View>

      {signatureModalVisible && (
        <SignatureCapture
          visible={signatureModalVisible}
          onClose={() => {
            setSignatureModalVisible(false);
            setCurrentSignatureField(null);
          }}
          onSave={handleSaveSignature}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 12,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldContainer: {
    flex: 1,
  },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  readOnlyContainer: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
  },
  readOnlyText: {
    fontSize: 14,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: "top",
  },
  booleanRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  booleanLabel: {
    marginLeft: 12,
    fontSize: 14,
  },
  optionList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  mediaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  mediaThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  mediaRemove: {
    position: "absolute",
    top: -6,
    right: -6,
  },
  mediaAddButton: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  helpText: {
    fontSize: 12,
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  checkboxContainer: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  radioContainer: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 10,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "white",
  },
  radioLabel: {
    fontSize: 14,
    flex: 1,
  },
  disabled: {
    opacity: 0.6,
  },
  unsupported: {
    fontSize: 13,
    fontStyle: "italic",
  },
  signatureContainer: {
    gap: 8,
  },
  signatureBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    minHeight: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  signaturePresent: {
    width: "100%",
    position: "relative",
  },
  signatureImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
  },
  signatureRemoveButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  signatureText: {
    fontSize: 14,
    fontWeight: "600",
  },
  signatureButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signatureButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  signatureViewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  tableContainer: {
    gap: 16,
  },
  tableEmpty: {
    fontSize: 13,
    fontStyle: "italic",
  },
  tableRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
    gap: 12,
  },
  tableRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tableRowTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  tableRemoveButton: {
    padding: 4,
  },
  tableColumn: {
    gap: 6,
  },
  tableColumnLabel: {
    fontSize: 12,
    textTransform: "uppercase",
  },
  tableInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
  },
  tableTextarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  tableSelectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tableOptionChip: {
    paddingVertical: 6,
  },
  tableAddButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tableAddButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  datePickerButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
  },
  datePickerText: {
    fontSize: 14,
    flex: 1,
  },
  iosPickerContainer: {
    backgroundColor: "white",
    borderRadius: 10,
    marginTop: 10,
    overflow: "hidden",
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iosPickerButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  iosPickerButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  iosDatePicker: {
    backgroundColor: "white",
  },
  repeatableSection: {
    gap: 12,
  },
  repeatableCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  repeatableHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  repeatableTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  repeatableSummary: {
    fontSize: 12,
    marginTop: 2,
  },
  repeatableAddButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  repeatableAddButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

export default InspectionForm;
