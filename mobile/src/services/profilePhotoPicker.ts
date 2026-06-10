import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

type ProfilePhotoSource = 'camera' | 'library';

const PROFILE_PHOTO_SIZE = 512;
const PROFILE_PHOTO_QUALITY = 0.72;

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

  const optimizedPhoto = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { height: PROFILE_PHOTO_SIZE, width: PROFILE_PHOTO_SIZE } }],
    {
      base64: true,
      compress: PROFILE_PHOTO_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG
    }
  );

  return {
    dataUrl: optimizedPhoto.base64 ? `data:image/jpeg;base64,${optimizedPhoto.base64}` : undefined,
    uri: optimizedPhoto.uri
  };
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
