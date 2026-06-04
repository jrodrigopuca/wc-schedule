import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

describe('test harness', () => {
  it('runs a pure arithmetic check', () => {
    expect(1 + 1).toBe(2)
  })

  it('mounts a trivial Vue component', () => {
    const TrivialComponent = defineComponent({
      name: 'Trivial',
      setup: () => () => h('span', { class: 'hello' }, 'hola'),
    })

    const wrapper = mount(TrivialComponent)
    expect(wrapper.text()).toBe('hola')
    expect(wrapper.find('.hello').exists()).toBe(true)
  })
})
