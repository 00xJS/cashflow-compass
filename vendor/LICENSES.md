# Vendored third-party libraries

These files are shipped unmodified so Cashflow Compass works offline and contacts
no third-party server at runtime. Both licences permit redistribution; the only
obligation is this notice.

## chart.umd.min.js — Chart.js 4.4.4

Copyright (c) 2014-2024 Chart.js Contributors
Licensed under the MIT License. Full text: https://github.com/chartjs/Chart.js/blob/master/LICENSE.md

## xlsx.full.min.js — SheetJS Community Edition 0.20.3

Copyright (C) 2012-present SheetJS LLC
Licensed under the Apache License, Version 2.0. Full text: https://www.apache.org/licenses/LICENSE-2.0

Obtained from https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js — the
official distribution point. Versions on npm and general-purpose CDNs stop at 0.18.5,
which carries unpatched prototype-pollution (CVE-2023-30533) and ReDoS (CVE-2024-22363)
advisories. Do not switch back to an npm-sourced build.
