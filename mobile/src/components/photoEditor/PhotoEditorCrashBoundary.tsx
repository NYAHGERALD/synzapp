import React from 'react';
import { getErrorMessage } from '../../services/chatDisplayFormatting';

/**
 * A crash boundary around the photo editor.
 *
 * Lifted out of the chat screen unchanged.
 */

interface PhotoEditorCrashBoundaryProps {
  children: React.ReactNode;
  onCrash: (message: string) => void;
  resetKey: string;
}

interface PhotoEditorCrashBoundaryState {
  didCrash: boolean;
}

export class PhotoEditorCrashBoundary extends React.Component<PhotoEditorCrashBoundaryProps, PhotoEditorCrashBoundaryState> {
  state: PhotoEditorCrashBoundaryState = { didCrash: false };

  static getDerivedStateFromError(): PhotoEditorCrashBoundaryState {
    return { didCrash: true };
  }

  componentDidCatch(error: Error) {
    this.props.onCrash(getErrorMessage(error, 'Unable to open the photo editor.'));
  }

  componentDidUpdate(previousProps: PhotoEditorCrashBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.didCrash) {
      this.setState({ didCrash: false });
    }
  }

  render() {
    if (this.state.didCrash) {
      return null;
    }

    return this.props.children;
  }
}
