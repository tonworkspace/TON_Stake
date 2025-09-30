import React, { useState, useEffect } from 'react';

interface FormattedNumericInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const FormattedNumericInput: React.FC<FormattedNumericInputProps> = ({
  value,
  onChange,
  placeholder,
  className,
}) => {
  const [displayValue, setDisplayValue] = useState('');

  // Format number with thousand separators
  const format = (numStr: string): string => {
    if (!numStr) return '';
    // Allow for decimal points if needed in the future, for now, integers.
    const number = parseInt(numStr.replace(/,/g, ''), 10);
    if (isNaN(number)) return '';
    return number.toLocaleString('en-US');
  };

  // Unformat number (remove separators)
  const unformat = (formattedStr: string): string => {
    return formattedStr.replace(/,/g, '');
  };

  useEffect(() => {
    // When the parent's value changes, update the display value
    setDisplayValue(format(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const unformattedValue = unformat(rawValue);

    // Allow only numeric characters
    if (/^\d*$/.test(unformattedValue)) {
      // Pass the raw, unformatted value up to the parent
      onChange(unformattedValue);
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      inputMode="numeric" // Helps with mobile keyboards
    />
  );
};

export default FormattedNumericInput;