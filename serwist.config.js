import {serwist} from '@serwist/next/config'

export default serwist.withNextConfig({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
})
