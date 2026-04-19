/// <reference types="@react-three/fiber" />

// Force R3F JSX augmentation in bundler module resolution mode
// This import side-effect registers ThreeElements into JSX.IntrinsicElements
import type {} from '@react-three/fiber'

export {}
