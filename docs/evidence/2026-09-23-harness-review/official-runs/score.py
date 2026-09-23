import math
def S(p,c):
    """official local simulator formula (local_submit.py L230-244): p in 0..100, c CNY"""
    if p<=0: return 0.0
    if c is None or c<=0: return None
    ref=1.2*p
    e=0.1 if c<=ref else 0.2
    return p/((c/ref)**e)
if __name__=='__main__':
    # sanity checks of elasticity
    for p,c in ((50,3),(50,6),(60,3),(60,6),(52,3.5)):
        print(p,c,round(S(p,c),3))
    print('halving cost factor', 2**0.1, 'equiv p factor', 2**(1/11))
    for p in (40,50,60,70):
        print('p',p,'halving c == +pp', round(p*(2**(1/11)-1),2), '; +1pp == cost x', round((p/(p+1))**11,3))
    # numerical elasticity check
    p,c=55,4.0; h=1e-6
    print('dlnS/dlnp', (math.log(S(p*(1+h),c))-math.log(S(p,c)))/math.log(1+h), 'dlnS/dlnc', (math.log(S(p,c*(1+h)))-math.log(S(p,c)))/math.log(1+h))
    p,c=10,20.0
    print('penalty regime dlnS/dlnp', (math.log(S(p*(1+h),c))-math.log(S(p,c)))/math.log(1+h), 'dlnS/dlnc', (math.log(S(p,c*(1+h)))-math.log(S(p,c)))/math.log(1+h))
