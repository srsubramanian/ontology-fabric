// The platform page's scripts were written against the CDN builds of Prism and Motion,
// which put `window.Prism` and `window.Motion` in place before any page script ran.
// This module does the same from the pinned npm packages, so the page stays self-contained.
import { animate, inView, stagger } from 'motion';
import '../kit/prism';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-turtle';

Object.assign(window, { Prism, Motion: { animate, inView, stagger } });
