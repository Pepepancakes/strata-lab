import { useState } from 'react'

/**
 * The (i) "what this means" button with its text, for a colour, flag or badge (John's standing rule:
 * every flag, colour and badge has a one-tap explanation). `what` completes the button's accessible name:
 * "What <what> means".
 */
export function WhatItMeans({ what, children }: { what: string; children: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span>
      <button className="info" aria-label={`What ${what} means`} aria-expanded={open} onClick={() => setOpen(!open)}>
        {'\u24d8'}
      </button>
      {open ? <span className="srctext" role="note">{children}</span> : null}
    </span>
  )
}

export const SALT_INFO = 'Salt: rock salt (halite) laid down before the run. It is weak and light (2,160 kg/m\u00b3), so under a heavy load of sediment it creeps sideways and upward like a very thick fluid. It has no pores and no pore fluid. The pink area is the salt that is left; where there is none, the sediment sits on the basement.'
export const COVER_INFO = 'Older cover: the sediment that lay on the salt before the run started. It is drawn a shade darker than the sediment the run lays down, and a dashed brown line marks its top. Everything above the dashed line is new.'
export const WELD_INFO = 'Weld: a place where the salt has been squeezed out so completely that the layers above and below it come back together (salt thinner than the weld thickness, a control under All other parameters). The heavy dark line sits on the base of the salt there. A well through a weld can go from the cover onto the basement with little or no salt. A weld also records that the salt was once thicker.'
export const BROKEN_PRESSURE_INFO = 'The pore-pressure line stops at the salt and starts again below it. Salt has no pore fluid, so there is no pore pressure to plot inside it. The dashed hydrostatic line and the overburden line (which uses the weight of salt, 2,160 kg/m\u00b3) carry on through the salt.'
