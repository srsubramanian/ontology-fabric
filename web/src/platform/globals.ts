// The platform page's remaining original scripts (the map, section nav, reading path and
// router) were written against the CDN build of Motion, which put `window.Motion` in place
// before any page script ran. This module does the same from the pinned npm package, so the
// page stays self-contained.
import { animate, inView, stagger } from 'motion';

Object.assign(window, { Motion: { animate, inView, stagger } });
