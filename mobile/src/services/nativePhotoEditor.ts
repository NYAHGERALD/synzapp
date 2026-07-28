import IMGLYEditor, {
  EditorPreset,
  EditorSettingsModel,
  SourceType
} from '@imgly/editor-react-native';

export interface NativePhotoEditorInput {
  fileName: string;
  height?: number;
  messageId: string;
  sourceUri: string;
  userId?: string;
  width?: number;
}

export interface NativePhotoEditorOutput {
  height?: number;
  thumbnailUri?: string;
  uri: string;
  width?: number;
}

export async function openNativePhotoEditor(input: NativePhotoEditorInput): Promise<NativePhotoEditorOutput | null> {
  const sourceUri = input.sourceUri.trim();

  if (!sourceUri) {
    throw new Error('This photo is not available on this device yet.');
  }

  const license = getNativePhotoEditorLicense();
  const result = await IMGLYEditor.openEditor(
    new EditorSettingsModel({
      license,
      userId: input.userId
    }),
    {
      source: sourceUri,
      type: SourceType.IMAGE
    },
    EditorPreset.PHOTO,
    {
      originalFileName: input.fileName,
      originalMessageId: input.messageId,
      product: 'synzapp-mobile-chat-photo-editor'
    }
  );

  if (!result) {
    return null;
  }

  const artifactUri = typeof result.artifact === 'string'
    ? result.artifact.trim()
    : '';

  if (!artifactUri) {
    throw new Error('The photo editor did not return an edited photo.');
  }

  return {
    height: input.height,
    thumbnailUri: typeof result.thumbnail === 'string' ? result.thumbnail : undefined,
    uri: artifactUri,
    width: input.width
  };
}

function getNativePhotoEditorLicense(): string | undefined {
  const license = process.env.EXPO_PUBLIC_IMGLY_EDITOR_LICENSE_KEY?.trim();

  return license || undefined;
}
