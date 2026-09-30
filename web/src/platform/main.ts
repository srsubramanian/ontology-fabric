// The platform overview. Every chapter is React (ch1/ to ch7/), rendered into its section
// before the page's remaining original scripts run: the map, the section nav, the reading
// path with each chapter's check, and the router that turns chapters into sub-pages. They
// still use the original markup in platform.html and the styles in platform.css.
import './platform.css';
import './globals';
import './ch1/mount';
import './ch2/mount';
import './ch3/mount';
import './ch4/mount';
import './ch5/mount';
import './ch6/mount';
import './ch7/mount';
import './legacy/01-map.js';
import './legacy/02-nav.js';
import './legacy/05-path.js';
import './legacy/08-router.js';
