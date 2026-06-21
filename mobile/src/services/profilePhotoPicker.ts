import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

type ProfilePhotoSource = 'camera' | 'library';

const PROFILE_PHOTO_SIZE = 512;
const PROFILE_PHOTO_QUALITY = 0.72;
const PROFILE_PHOTO_MAX_DATA_URL_LENGTH = 1_200_000;
const PROFILE_PHOTO_OPTIMIZATION_STEPS = [
  { quality: PROFILE_PHOTO_QUALITY, size: PROFILE_PHOTO_SIZE },
  { quality: 0.62, size: 448 },
  { quality: 0.54, size: 384 },
  { quality: 0.46, size: 320 }
] as const;

export interface PickedProfilePhoto {
  dataUrl?: string;
  uri: string;
}

interface PickNativeProfilePhotoOptions {
  message?: string;
  title?: string;
}

const imagePickerOptions = {
  allowsEditing: true,
  aspect: [1, 1] as [number, number],
  base64: false,
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.9
};

export async function pickNativeProfilePhoto(
  options: PickNativeProfilePhotoOptions = {}
): Promise<PickedProfilePhoto | null> {
  const source = await selectProfilePhotoSource(options);

  if (!source) {
    return null;
  }

  const result = source === 'camera'
    ? await launchCamera()
    : await launchPhotoLibrary();

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const optimizedPhoto = await optimizeProfilePhoto(result.assets[0].uri);

  return {
    dataUrl: optimizedPhoto.base64 ? `data:image/jpeg;base64,${optimizedPhoto.base64}` : undefined,
    uri: optimizedPhoto.uri
  };
}

async function optimizeProfilePhoto(uri: string): Promise<ImageManipulator.ImageResult> {
  let latestPhoto: ImageManipulator.ImageResult | null = null;

  for (const step of PROFILE_PHOTO_OPTIMIZATION_STEPS) {
    latestPhoto = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { height: step.size, width: step.size } }],
      {
        base64: true,
        compress: step.quality,
        format: ImageManipulator.SaveFormat.JPEG
      }
    );

    const dataUrlLength = latestPhoto.base64
      ? `data:image/jpeg;base64,${latestPhoto.base64}`.length
      : 0;

    if (dataUrlLength > 0 && dataUrlLength <= PROFILE_PHOTO_MAX_DATA_URL_LENGTH) {
      return latestPhoto;
    }
  }

  if (latestPhoto?.base64) {
    throw new Error('This photo is too large to upload. Please take another photo with less detail or choose a smaller image.');
  }

  throw new Error('Unable to prepare this profile photo. Please choose another image.');
}

async function launchCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Camera access is needed to take a profile photo.');
  }

  return ImagePicker.launchCameraAsync(imagePickerOptions);
}

async function launchPhotoLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Photo library access is needed to add a profile photo.');
  }

  return ImagePicker.launchImageLibraryAsync(imagePickerOptions);
}

function selectProfilePhotoSource(
  options: PickNativeProfilePhotoOptions
): Promise<ProfilePhotoSource | null> {
  return new Promise((resolve) => {
    const title = options.title || 'Profile photo';
    const message = options.message || 'Add a photo using your camera or photo library.';
    let resolved = false;
    const done = (source: ProfilePhotoSource | null) => {
      if (resolved) {
        return;
      }

      resolved = true;
      resolve(source);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 2,
          options: ['Take photo', 'Choose from library', 'Cancel'],
          title
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            done('camera');
            return;
          }

          if (buttonIndex === 1) {
            done('library');
            return;
          }

          done(null);
        }
      );
      return;
    }

    Alert.alert(
      title,
      message,
      [
        {
          onPress: () => done('camera'),
          text: 'Camera'
        },
        {
          onPress: () => done('library'),
          text: 'Photo library'
        },
        {
          onPress: () => done(null),
          style: 'cancel',
          text: 'Cancel'
        }
      ],
      {
        cancelable: true,
        onDismiss: () => done(null)
      }
    );
  });
}
