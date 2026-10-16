# M3.10 Gulf preset: the basinward edge fix

Numbers from `scripts/review/m3-10-edge.mjs` (parts `table`, `crests`, `ulp`, `grid`, `hash`, `sweep`), Windows, Node 26, dx 1,000 m, 400 columns, 66 Myr. In the tables salt is in metres and the seafloor in feet (engine elevation, positive up: negative means below the sea-level datum). Columns are every 10 km (centre of the column). The 66 Ma column is the state after the first step.

## Cause (plain words)

In the M3.9 preset the salt starts 4 km thick everywhere from 100 km to the end of the section at 400 km. The basinward edge of the section is closed (no salt can leave: that is what keeps the salt balance exact). The wedge loads the salt landward of about 250 km and squeezes it basinward, at a mean of 9.1 m2/yr across the 250 km face over the 66 Myr. With nowhere to go and nothing to spread into, the salt stacks up against the closed edge. The salt volume beyond 250 km doubled from 600 km2 to 1,202 km2, and the volume in the last 20 km went from 80 to 173 km2 (flux at the last face is zero by the closed-edge condition). The result is one slab 8 to 9 km thick (twice the 4 km start) from 250 km to the edge, and the four "shallow crests" were ripples of a few hundred metres on that slab. This is the edge, not the geology.

## Fix

Two new start-only parameters, `saltLimitStart` and `saltLimitEnd` (smoothstep, as the landward pinch-out): full thickness landward of the first, none basinward of the second. Defaults 2,000 and 2,500 km are beyond any section (400 columns x 5 km = 2,000 km at most), and a column landward of `saltLimitStart` takes the same code path as before, so every existing run is bit-identical.

| | old (M3.9) | new (M3.10) | source |
|---|---|---|---|
| `saltLimitStart` | none (2,000 km default) | 200 km | tuned; Hudec et al. (2013) for the idea only |
| `saltLimitEnd` | none (2,500 km default) | 240 km | tuned |
| salt in the section at the start | 1,380 km2 | 660 km2 | follows |

The idea has a source: Hudec, Norton, Jackson & Peel (2013), AAPG Bulletin 97(10), 1683-1710, say (abstract read; not the full paper) that the limit of normal oceanic crust coincides with a basement ramp near the seaward end of the salt basin, and that salt in places flowed seaward onto new oceanic crust. So the Louann basin does end, and salt does spread past its depositional limit. The position in kilometres is not in the abstract and the synthetic section is not scaled to the Gulf, so 200/240 km is **tuned**: it ends the basin about 160 km inside the section so that salt that flows out of it has room, and no more. It was chosen from a sweep of the limit (150/190, 175/215, 200/240, 200/260, 220/240, 250/290, 300/340 km), by the pile test, not by the crest count. The sweep is in the table below.

| limit start/end | max salt beyond 250 km | max salt in last 20 km | weld total (km) |
|---|---|---|---|
| none (M3.9) | 9,068 m | 9,068 m | 8 |
| 300/340 km | 9,284 m | 151 m | 11 |
| 250/290 km | 7,569 m | 0 | 14 |
| 220/240 km | 5,220 m | 0 | 16 |
| 200/260 km | 5,215 m | 0 | 14 |
| **200/240 km** | **5,002 m** | **0** | **17** |
| 175/215 km | 4,224 m | 0 | 9 |
| 150/190 km | 980 m | 0 | 15 |

The salt still flows 115 km beyond the end of its depositional limit by the end of the run (front at 355 km, 45 km short of the edge), and is 5.0 km thick at most, 1.25 times the start. That is what Hudec et al. describe qualitatively, not a result of tuning to a number. The cost: the salt basin holds 660 km2 instead of 1,380 km2.


## Crests within 2 km of the seafloor (new preset, plain run), 20 km or more from the section edge and the salt edges

Salt basin edges at the end of the run (more than 100 m of salt): 18.5 to 355.5 km. Minimum prominence 300 m.

| km | salt thick (m) | prominence (m) | cover over the salt (ft) |
|---|---|---|---|
| 286.5 | 5,002 | 5,002 (the slab's own top) | 4,456 |
| 308.5 | 4,501 | 304 | 5,860 |
| 314.5 | 4,801 | 850 | 4,243 |
| 318.5 | 4,221 | 471 | 6,235 |
| 322.5 | 4,168 | 434 | 6,421 |

5 crests; 2, 3, 3, 4, 5, 5 across the six noise salts (3, 5, 7, 11, 13, 17: 5, 4, 3, 5, 2, 3 in that order). None is within 1.3 km (4,243 ft) of the seafloor. M3.9 had four (287.5, 314.5, 354.5, 389.5 km), the last one inside the 20 km edge zone. Seeded ripples on a flat slab: relief is 7 to 18 % of the slab thickness for the four smaller ones. Not diapirs. The seed and supply were not touched.

## Weld runs under 1 ulp noise (salt thinner than 100 m, thicker before)

| noise salt | runs | total km | longest km | runs of 2 km or more |
|---|---|---|---|---|
| plain | 6 | 17 | 4 | 6 |
| 3 | 7 | 14 | 3 | 5 |
| 5 | 7 | 18 | 4 | 7 |
| 7 | 6 | 14 | 3 | 5 |
| 11 | 7 | 15 | 3 | 6 |
| 13 | 11 | 20 | 3 | 6 |
| 17 | 6 | 12 | 3 | 4 |

Band asserted: total weld length 8 km or more and a longest run of 2 km or more, in all seven. Spread of the total: 12 to 20 km (min is 1.5 times the band). Wavelength 13.1 to 13.8 km across the noise salts, 14.1 km plain.

## Grid check, 200 km section (record holds 400 columns, so dx 500 m can cover only 200 km)

| dx | wavelength (km) | salt highs | mean spacing (km) | minibasins | weld runs | total weld (km) |
|---|---|---|---|---|---|---|
| 1,000 m | 23.2 | 4 | 16.0 | 4 | 6 | 14 |
| 500 m | 22.9 | 5 | 17.6 | 5 | 6 | 18.5 |

Wavelength differs by 1.3 %, spacing by 9.6 %. (M3.9: 10.6 % and 59.6 % / 25.8 % for count and spacing.) The salt basin limit starts at 200 km, so on this section the salt basin runs to the section edge and has an edge pile of its own; the check is for structure width, not the edge. Run time 3.2 s (dx 1,000, 200 columns), 5.8 s (dx 500, 400 columns). At dx 2,000 over 400 km: 16 highs, spacing 21.5 km, wavelength 12.8 km, against 18 highs, 19.2 km and 14.1 km at dx 1,000 (12 % and 9 %).

## stateHash, this machine (Windows, Node 26)

| preset | stateHash | same as |
|---|---|---|
| last3 | cb22255bd39a216a | main |
| mtd | 9be1b3f383e0bb5e | main |
| miocene | fa992a56e93157c3 | main |
| cenozoic | ebd3965bbcc65cca | main |
| saltshort | b9d410d60a5de2e7 | strata-lab/m3-09-rereview |
| gulf | f2e2fd2ca42afb35 (was dae567c797f04b2a at M3.9; changed on purpose) | |

## Speed, best of three, run twice alternately with main (ms)

| preset | main | this branch |
|---|---|---|
| last3 | 1421 / 1461 | 1414 / 1475 |
| mtd | 2173 / 2127 | 2208 / 2082 |
| miocene | 2316 / 2314 | 2334 / 2298 |
| cenozoic | 2845 / 2745 | 2728 / 2744 |

All within 5 % (the first, non-interleaved pass read mtd +12.7 %: that was machine noise, it came out -2 % to +1.6 % when interleaved). Gulf preset run time 5.0 to 5.1 s (M3.9: 5.4 to 6.0 s). saltshort 0.40 s.

## Salt volume

| age | salt in section (km2) | beyond 250 km (km2) | last 20 km (km2) |
|---|---|---|---|
| M3.9, 66 Ma | 1,380 | 600 | 80 |
| M3.9, 40 Ma | 1,380 | 836 | 111 |
| M3.9, 20 Ma | 1,380 | 1,043 | 142 |
| M3.9, 0 Ma | 1,380 | 1,202 | 173 |
| M3.10, 66 Ma | 660 | 0 | 0 |
| M3.10, 40 Ma | 660 | 79 | 0 |
| M3.10, 20 Ma | 660 | 261 | 0 |
| M3.10, 0 Ma | 660 | 409 | 0 |

Mean salt flux across the 250 km face over the run: 9.1 m2/yr (M3.9), 6.2 m2/yr (M3.10). Flux at the last face: 0 (closed edge) in both; what changed is that nothing reaches it.

## Salt thickness (m) and seafloor (ft) every 10 km: M3.10 (the preset now)

```
km  | salt m at 66/40/20/0 Ma | seafloor ft
   4.5      0      0      0      0 |     512     508     533     362
  14.5     29     29     30     30 |     492     469     493     321
  24.5    277    313    412    637 |     444     443     456     283
  34.5    722    570    675     85 |    -312     392     413     238
  44.5   1268   1126   1927   2778 |   -1517     373     390     209
  54.5   1857   1223   1540   1809 |   -3089     310     347     167
  64.5   2668    853    669    324 |   -4172     168     307     126
  74.5   3228    349    235    142 |   -4835     101     275      92
  84.5   3691    720    586    533 |   -5146      52     242      57
  94.5   3957   1228   1526   1799 |   -5368      76     213      30
 104.5   4005   1277    856    456 |   -5539     -17     174       9
 114.5   3999   1122   1454   1792 |   -5710     -38     154      -3
 124.5   4009   1146    825    669 |   -5832    -356     128     -29
 134.5   4017   2006    711    782 |   -5959    -545     115    -178
 144.5   4016   2570    874    569 |   -6080    -543      93    -225
 154.5   4021   2985   1416   1005 |   -6113    -596      80    -271
 164.5   4014   3492   1782   1650 |   -6173    -635      68    -277
 174.5   4003   3957   1517   1431 |   -6238    -689      56    -303
 184.5   3999   4740   1174   1102 |   -6263    -788      20    -317
 194.5   4002   5858   1487    955 |   -6253   -1101    -682    -346
 204.5   3859   6337   3674    749 |   -6263   -1413   -1409    -374
 214.5   2807   5643   5045    553 |   -6251   -1776   -1855    -487
 224.5   1333   4397   4730   1089 |   -6271   -2156   -2206    -792
 234.5    206   3704   4484   2751 |   -6261   -2540   -2528   -2001
 244.5      0   3273   4269   3838 |   -6261   -2943   -2843   -2578
 254.5      0   2958   4088   4253 |   -6261   -3375   -3152   -2972
 264.5      0   2709   4058   4791 |   -6261   -3827   -3455   -3278
 274.5      0   2026   3811   4835 |   -6261   -4256   -3746   -3561
 284.5      0      4   3569   4787 |   -6261   -5850   -4055   -3840
 294.5      0      0   3177   4511 |   -6261   -6951   -4386   -4118
 304.5      0      0   3120   4566 |   -6261   -7611   -4711   -4392
 314.5      0      0   2830   4801 |   -6261   -7936   -5061   -4661
 324.5      0      0   1729   3609 |   -6260   -8227   -5608   -4914
 334.5      0      0      0   2620 |   -6260   -8450   -6541   -5157
 344.5      0      0      0   2013 |   -6260   -8616   -7270   -5385
 354.5      0      0      0    493 |   -6260   -8743   -7508   -5634
 364.5      0      0      0      0 |   -6260   -8829   -7681   -5885
 374.5      0      0      0      0 |   -6260   -8876   -7783   -6014
 384.5      0      0      0      0 |   -6260   -8906   -7826   -6083
 394.5      0      0      0      0 |   -6260   -8928   -7851   -6111
final: max salt >250 km 5001.759324920732 max salt within 20 km of edge 0
clip 0
age 66 salt volume km2: total 660.0 | beyond 250 km 0.0 | last 20 km 0.0
age 40 salt volume km2: total 660.0 | beyond 250 km 79.1 | last 20 km 0.0
age 20 salt volume km2: total 660.0 | beyond 250 km 260.8 | last 20 km 0.0
age 0.001 salt volume km2: total 660.0 | beyond 250 km 408.6 | last 20 km 0.0
mean salt flux across the 250 km face over the run (m2/yr) = 6.19 ; flux at the last face = 0 (closed edge)
```

## Salt thickness (m) and seafloor (ft) every 10 km: M3.9 (before; same run without the limit)

```
km  | salt m at 66/40/20/0 Ma | seafloor ft
   4.5      0      0      0      0 |     512     455     514     359
  14.5     29     29     30     30 |     492     417     474     317
  24.5    277    313    411    637 |     444     391     437     280
  34.5    722    575    602    145 |    -312     341     395     235
  44.5   1268    625    120     41 |   -1517     219     359     200
  54.5   1857    506    532    546 |   -3089     200     325     162
  64.5   2668    676    478    201 |   -4172     103     288     123
  74.5   3228    405    293    248 |   -4835      39     255      89
  84.5   3691    787    976   1159 |   -5146      29     224      55
  94.5   3957    682    666    674 |   -5368     -55     190      27
 104.5   4005    748    737    726 |   -5539    -107     159       9
 114.5   3999    801    914    894 |   -5710    -170     128      -5
 124.5   4009    724    874    987 |   -5832    -260      99     -45
 134.5   4017    587    651    718 |   -5959    -422      81    -105
 144.5   4016    550    525    565 |   -6080    -871      66    -222
 154.5   4021   1828    333    381 |   -6113   -2274      51    -256
 164.5   4014   3191    483    505 |   -6173   -3059      37    -284
 174.5   4003   3979    400    368 |   -6238   -3519     -37    -303
 184.5   3999   4514    440    324 |   -6263   -3814   -1094    -331
 194.5   4003   4910   1144    459 |   -6253   -4028   -2120    -353
 204.5   4000   5129   2467    478 |   -6262   -4220   -2887    -396
 214.5   4003   5314   3822    590 |   -6251   -4382   -3387    -510
 224.5   3997   5395   4584    817 |   -6272   -4541   -3716   -1356
 234.5   3994   5475   5141   1595 |   -6282   -4667   -3932   -2509
 244.5   4010   5680   6027   3521 |   -6230   -4744   -4067   -3158
 254.5   3996   5621   6362   4615 |   -6274   -4834   -4143   -3537
 264.5   3996   5629   6697   6020 |   -6272   -4901   -4192   -3744
 274.5   3991   5590   6755   7107 |   -6292   -4971   -4239   -3841
 284.5   4004   5631   6932   8057 |   -6248   -5023   -4284   -3869
 294.5   3999   5593   6918   8094 |   -6264   -5086   -4329   -3904
 304.5   4000   5580   6956   8283 |   -6261   -5141   -4373   -3932
 314.5   4007   5732   7199   8741 |   -6237   -5185   -4413   -3957
 324.5   4001   5557   7007   8495 |   -6258   -5243   -4452   -3984
 334.5   3999   5537   7009   8524 |   -6265   -5289   -4487   -4008
 344.5   3999   5527   7027   8578 |   -6265   -5330   -4519   -4028
 354.5   4009   5759   7330   8969 |   -6231   -5355   -4546   -4045
 364.5   3992   5494   7010   8550 |   -6285   -5401   -4570   -4062
 374.5   3997   5505   7042   8609 |   -6271   -5424   -4588   -4075
 384.5   4004   5558   7115   8709 |   -6246   -5439   -4600   -4082
 394.5   3995   5492   7023   8575 |   -6277   -5455   -4607   -4087
final: max salt >250 km 9068.30321766926 max salt within 20 km of edge 9068.30321766926
clip 0
```

## Reproduce

    node scripts/review/m3-10-edge.mjs table|crests|ulp|grid|hash|sweep
    OVER='{...}' node scripts/review/m3-10-edge.mjs table   (overrides, e.g. the M3.9 values saltLimitStart 2e6, saltLimitEnd 2.5e6)
    REVIEW_ROOT=<other worktree> node scripts/review/m3-10-edge.mjs hash   (compare with main)
