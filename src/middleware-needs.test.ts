import { Hono } from './hono'
import { createMiddleware, defineMiddleware } from './helper/factory'
import type { MiddlewareHandler, NeedsVariables } from './types'

type UserEnv = { Variables: { user: { id: number } } }

const setUser: MiddlewareHandler<UserEnv> = async (c, next) => {
  c.set('user', { id: 1 })
  await next()
}

// Hand-written for now: needs `user`, sets nothing.
const limitByUser = (async (c, next) => {
  c.header('x-user', String(c.get('user').id))
  await next()
}) as MiddlewareHandler<UserEnv> as MiddlewareHandler & NeedsVariables<UserEnv>

describe('Middleware needs', () => {
  it('accepts a middleware whose needs an earlier one sets', async () => {
    const app = new Hono().get('/', setUser, limitByUser, (c) => c.text('ok'))
    const res = await app.request('/')
    expect(res.headers.get('x-user')).toBe('1')
  })

  it('accepts it when the router env already has the variables', () => {
    new Hono<UserEnv>().get('/', limitByUser, (c) => c.text('ok'))
  })

  it('refuses a middleware whose needs nothing earlier sets', () => {
    // @ts-expect-error user is not set before limitByUser
    new Hono().get('/', limitByUser, (c) => c.text('ok'))
  })

  it('refuses it when the setting middleware comes after', () => {
    // @ts-expect-error user is set only after limitByUser
    new Hono().get('/', limitByUser, setUser, (c) => c.text('ok'))
  })

  it('leaves plain middleware unchecked', () => {
    const plain: MiddlewareHandler = async (_c, next) => next()
    new Hono().post('/x', plain, plain, (c) => c.text('ok'))
  })
})

describe('defineMiddleware', () => {
  const requireUser = createMiddleware<UserEnv>(async (c, next) => {
    c.set('user', { id: 7 })
    await next()
  })
  const limitByUser = defineMiddleware<{ needs: UserEnv }>(async (c, next) => {
    c.header('x-user', String(c.get('user').id))
    await next()
  })
  const addOrg = defineMiddleware<{ needs: UserEnv; adds: { Variables: { orgId: number } } }>(
    async (c, next) => {
      c.set('orgId', c.get('user').id * 10)
      await next()
    }
  )

  it('types the needed variables inside the middleware and runs it', async () => {
    const app = new Hono().post('/reset', requireUser, limitByUser, (c) => c.text('ok'))
    const res = await app.request('/reset', { method: 'POST' })
    expect(res.headers.get('x-user')).toBe('7')
  })

  it('refuses it on a route where nothing sets the needed variables', () => {
    // @ts-expect-error user is not set before limitByUser
    new Hono().post('/reset', limitByUser, (c) => c.text('ok'))
  })

  it('accepts it after middleware chained on the router', () => {
    new Hono().use(requireUser).post('/reset', limitByUser, (c) => c.text('ok'))
  })

  it('works like createMiddleware with only adds', async () => {
    const setUser = defineMiddleware<{ adds: UserEnv }>(async (c, next) => {
      c.set('user', { id: 3 })
      await next()
    })
    const app = new Hono().get('/', setUser, limitByUser, (c) => c.text('ok'))
    const res = await app.request('/')
    expect(res.headers.get('x-user')).toBe('3')
  })

  it('passes what it adds on to later handlers', async () => {
    const app = new Hono().get('/', requireUser, addOrg, (c) => {
      expectTypeOf(c.get('orgId')).toEqualTypeOf<number>()
      return c.text(String(c.get('orgId')))
    })
    const res = await app.request('/')
    expect(await res.text()).toBe('70')
  })
})
