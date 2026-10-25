import 'server-only'

import {db} from '..'
import {createAccountRepository} from '../repositories/account'

export const accountRepository = createAccountRepository(db)
