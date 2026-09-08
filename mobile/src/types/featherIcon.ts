import type Feather from '@expo/vector-icons/Feather';
import type React from 'react';

/**
 * The name of a Feather glyph.
 *
 * Kept here rather than in any one screen because a dozen unrelated surfaces
 * take an icon name as a prop, and each extraction would otherwise have to drag
 * the screen it came from along with it.
 */
export type FeatherIconName = React.ComponentProps<typeof Feather>['name'];
