import { describe, expect, it } from 'vitest'
import {
  buildKey,
  mapChannel,
  planUploads,
  typeForExt,
} from '../.github/actions/artifact-push/src/plan.js'

describe('mapChannel', () => {
  it('maps build_mode to the hub dictionary', () => {
    expect(mapChannel('', 'release')).toBe('stable')
    expect(mapChannel('', 'pre-release')).toBe('rc')
    expect(mapChannel('', 'develop')).toBe('dev')
    expect(mapChannel('', 'master')).toBe('dev')
    expect(mapChannel('', '')).toBe('dev')
  })

  it('explicit channel wins over build_mode', () => {
    expect(mapChannel('rc', 'release')).toBe('rc')
  })

  it('rejects unknown channels', () => {
    expect(() => mapChannel('release', '')).toThrow(/invalid channel/)
  })
})

describe('typeForExt', () => {
  it('image extensions', () => {
    for (const ext of ['img', 'xz', 'qcow2', 'ova', 'vdi', 'vmdk']) {
      expect(typeForExt(ext)).toBe('image')
    }
  })

  it('extra extensions', () => {
    for (const ext of ['sha', 'zip', 'ovf', 'txt']) {
      expect(typeForExt(ext)).toBe('extra')
    }
  })

  it('unknown extensions are skipped, not errors', () => {
    expect(typeForExt('exe')).toBeNull()
    expect(typeForExt('json')).toBeNull()
  })
})

describe('buildKey', () => {
  it('with platform', () => {
    expect(
      buildKey({ channel: 'stable', product: 'klever5', version: '0.10.0', ext: 'xz', platform: 'rpi5b' }),
    ).toBe('stable/klever5/rpi5b-0.10.0.xz')
  })

  it('without platform falls back to product name', () => {
    expect(
      buildKey({ channel: 'rc', product: 'simulator', version: '0.3.0-rc.1', ext: 'qcow2' }),
    ).toBe('rc/simulator/0.3.0-rc.1.qcow2')
  })
})

describe('planUploads', () => {
  const base = {
    product: 'klever5',
    version: '0.10.0',
    channel: 'stable',
    platform: 'rpi5b',
    sha: 'a1b2c3d',
    runId: '99',
  }

  it('plans image + checksum pair with hub tags', () => {
    const { uploads: plans } = planUploads(
      [
        'build/output/images/klever5-rpi5b.img.xz',
        'build/output/images/klever5-rpi5b.img.xz.sha',
        'build/output/images/klever5-rpi5b.img.xz.assets.json',
      ],
      base,
    )
    expect(plans).toHaveLength(2)
    expect(plans[0]?.key).toBe('stable/klever5/rpi5b-0.10.0.xz')
    expect(plans[0]?.tags).toEqual({
      product: 'klever5',
      version: '0.10.0',
      channel: 'stable',
      type: 'image',
      platform: 'rpi5b',
      sha: 'a1b2c3d',
      run_id: '99',
    })
    expect(plans[1]?.key).toBe('stable/klever5/rpi5b-0.10.0.sha')
    expect(plans[1]?.tags.type).toBe('extra')
  })

  it('reports non-whitelisted files as skipped', () => {
    const { uploads, skipped } = planUploads(
      ['a.img.xz', 'a.img.xz.sha', 'a.img.xz.assets.json', 'Makefile'],
      base,
    )
    expect(uploads.map((u) => u.key)).toEqual([
      'stable/klever5/rpi5b-0.10.0.xz',
      'stable/klever5/rpi5b-0.10.0.sha',
    ])
    expect(skipped).toEqual(['a.img.xz.assets.json', 'Makefile'])
  })

  it('fails when nothing survives the whitelist', () => {
    expect(() => planUploads(['a.json'], base)).toThrow(/no uploadable artifacts/)
  })

  it('omits optional tags when not given', () => {
    const { uploads: plans } = planUploads(['a.qcow2'], { product: 'simulator', version: '1.0.0', channel: 'dev' })
    expect(plans[0]?.tags).toEqual({
      product: 'simulator',
      version: '1.0.0',
      channel: 'dev',
      type: 'image',
    })
  })

  it('requires product and version', () => {
    expect(() => planUploads(['a.xz'], { product: '', version: '1.0.0', channel: 'dev' })).toThrow(/product/)
    expect(() => planUploads(['a.xz'], { product: 'p', version: '', channel: 'dev' })).toThrow(/version/)
  })


})
