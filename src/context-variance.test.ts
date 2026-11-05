import { Context } from './context'

type Foo = { Variables: { foo: string } }
type FooBar = { Variables: { foo: string; bar: number } }

describe('Context accepts more variables than required', () => {
  it('passes a context with extra variables to a helper that needs fewer', () => {
    const needsFoo = (c: Context<Foo>) => c.get('foo')
    const c = new Context(new Request('http://localhost/')) as unknown as Context<FooBar>
    c.set('foo', 'hello')
    c.set('bar', 1)
    expect(needsFoo(c)).toBe('hello')
  })

  it('refuses a context that lacks a required variable', () => {
    const needsFooBar = (c: Context<FooBar>) => c.get('bar')
    const c = new Context(new Request('http://localhost/')) as unknown as Context<Foo>
    // @ts-expect-error bar is missing
    needsFooBar(c)
  })

  it('keeps get and set typed', () => {
    const c = new Context(new Request('http://localhost/')) as unknown as Context<Foo>
    // @ts-expect-error foo is a string
    c.set('foo', 1)
    // @ts-expect-error unknown variable
    c.set('baz', 'x')
    expectTypeOf(c.get('foo')).toEqualTypeOf<string>()
  })

  it('still allows destructuring set and get', () => {
    const c = new Context(new Request('http://localhost/')) as unknown as Context<Foo>
    const { set, get } = c
    set('foo', 'destructured')
    expect(get('foo')).toBe('destructured')
  })
})
