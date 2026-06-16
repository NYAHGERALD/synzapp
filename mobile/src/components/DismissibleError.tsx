import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

interface DismissibleErrorProps {
  message: string;
  onDismiss: () => void;
  title?: string;
}

export function DismissibleError({
  message,
  onDismiss,
  title = 'Something needs attention'
}: DismissibleErrorProps) {
  const lastShownMessageRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || trimmedMessage === lastShownMessageRef.current) {
      return;
    }

    lastShownMessageRef.current = trimmedMessage;
    Alert.alert(
      title,
      trimmedMessage,
      [{ text: 'OK', onPress: onDismiss }],
      { cancelable: true, onDismiss }
    );
  }, [message, onDismiss, title]);

  return null;
}
