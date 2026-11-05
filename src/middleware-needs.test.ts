import { Hono } from './hono'
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
