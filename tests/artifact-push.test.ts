import { describe, expect, it } from 'vitest'
import {
  buildKey,
  mapChannel,
  planUploads,
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

describe('buildKey', () => {
  it('with platform', () => {
    expect(
      buildKey({ channel: 'stable', product: 'klever5', version: '0.10.0', ext: 'zip', platform: 'rpi5b' }),
    ).toBe('stable/klever5/klever5-rpi5b-0.10.0.zip')
  })

  it('without platform', () => {
    expect(
      buildKey({ channel: 'rc', product: 'simulator', version: '0.3.0-rc.1', ext: 'qcow2' }),
    ).toBe('rc/simulator/simulator-0.3.0-rc.1.qcow2')
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

  it('tags every file with the caller-provided type', () => {
    const plans = planUploads(
      ['out/klever5-rpi5b.img.zip', 'out/klever5-rpi5b.img.zip.sha'],
      { ...base, type: 'image' },
    )
    expect(plans).toHaveLength(2)
    expect(plans[0]?.key).toBe('stable/klever5/klever5-rpi5b-0.10.0.zip')
    expect(plans[1]?.key).toBe('stable/klever5/klever5-rpi5b-0.10.0.sha')
    expect(plans[0]?.tags).toEqual({
      product: 'klever5',
      version: '0.10.0',
      channel: 'stable',
      type: 'image',
      platform: 'rpi5b',
      sha: 'a1b2c3d',
      run_id: '99',
    })
  })

  it('no type input — no type tag; nothing is guessed from the extension', () => {
    const plans = planUploads(['a.qcow2', 'a.sha'], base)
    expect(plans[0]?.tags.type).toBeUndefined()
    expect(plans[1]?.tags.type).toBeUndefined()
  })

  it('uploads whatever matched — no whitelist filtering', () => {
    const plans = planUploads(['a.img', 'b.json', 'c.txt'], { ...base, type: 'extra' })
    expect(plans.map((p) => p.key)).toEqual([
      'stable/klever5/klever5-rpi5b-0.10.0.img',
      'stable/klever5/klever5-rpi5b-0.10.0.json',
      'stable/klever5/klever5-rpi5b-0.10.0.txt',
    ])
  })

  it('requires product, version and files', () => {
    expect(() => planUploads(['a.zip'], { product: '', version: '1', channel: 'dev' })).toThrow(/product/)
    expect(() => planUploads(['a.zip'], { product: 'p', version: '', channel: 'dev' })).toThrow(/version/)
    expect(() => planUploads([], { product: 'p', version: '1', channel: 'dev' })).toThrow(/no files/)
  })

  it('extension-less files cannot be named', () => {
    expect(() => planUploads(['Makefile'], base)).toThrow(/extension/)
  })
})
