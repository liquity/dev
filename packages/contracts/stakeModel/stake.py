
import random

# params
number_of_troves = 10
new_coll = 10e18

class TimeSeries():
    def __init__(self):
        self.last_step = 0
        self.steps = []
        self.stakes = []
        self.colls = []
        self.stake_to_coll_ratios = []

    def last_stake(self):
        return self.stakes[len(self.stakes)-1]

    def last_coll(self):
        return self.colls[len(self.colls)-1]
    
    def last_stake_to_coll_ratio(self):
        return self.stake_to_coll_ratios[len(self.stake_to_coll_ratios)-1]
    

class Liquity():
    def __init__(self):
        self.total_stakes = 0
        self.total_coll = 0
        self.troves_list = []
        self.trove_count = 0
    
class Trove():
    def calc_stake(self, coll, liquity):
        # pre-liquidation logic
        if (liquity.total_coll == 0):
            stake = coll
        else: # stake logic after first liquidation
            stake = coll * liquity.total_stakes // liquity.total_coll

        return stake

    def __init__(self, coll, liquity):
        self.stake = self.calc_stake(coll, liquity)
        self.coll = coll

# Action functions    
def make_trove(coll, liquity):
    trove = Trove(coll, liquity)
    liquity.troves_list.append(trove)
    liquity.total_coll += trove.coll
    liquity.total_stakes += trove.stake
    liquity.trove_count += 1

    return trove

# remove trove and it's stake, but not coll
def liquidate(idx, liquity):
    liquity.total_stakes -= liquity.troves_list[idx].stake
    liquity.total_coll -=  liquity.troves_list[idx].coll
    liquity.troves_list.pop(idx)
    liquity.trove_count -= 1

def liquidate_and_make_new_trove(new_coll, liquity, time_series):
    liquidate(get_rand_trove_idx(liquity), liquity)
    trove = make_trove(new_coll, liquity)

    update_time_series(trove.coll, trove.stake, time_series)

def liquidate_oldest_and_make_new_trove(new_coll, liquity, time_series):
    liquidate(0, liquity)  
    trove = make_trove(new_coll, liquity)

    update_time_series(trove.coll, trove.stake, time_series)

def update_time_series(coll, stake, time_series):
    time_series.colls.append(coll)
    time_series.stakes.append(stake)
    time_series.stake_to_coll_ratios.append(stake/coll)

def get_rand_trove_idx(liquity):
    return random.randint(0, len(liquity.troves_list)-1)

def close_first_trove():
    liquity.total_stakes -= liquity.troves_list[0].stake
    liquity.total_coll -=  liquity.troves_list[0].coll
    liquity.troves_list.pop(0)
    liquity.trove_count -= 1



### Program

# Setup - create Liquity and troves
liquity = Liquity()
time_series = TimeSeries()

step = 0

for i in range(number_of_troves):
    make_trove(1e18, liquity)

print(f"total stakes: {liquity.total_coll}")
print(f"total coll: {liquity.total_coll}")
print(f"total troves: {liquity.trove_count}")

# # Main simulation loop
for i in range(10000):
    print(f"step: {step}")
    time_series.steps.append(step)
    # close_first_trove()
    liquidate_oldest_and_make_new_trove(new_coll, liquity, time_series)

    print(f"last stake: {time_series.last_stake()}")
    print(f"last coll: {time_series.last_coll()}")
    print(f"liquity total coll: {liquity.total_coll}")

    last_step = step
    step += 1


    
# with liquidated troves, and new troves, total coll increases forever, but the fraction liquidated decreases.
# we want to actually the rate of decline of stakes for constant liquidated fraction.
#
# we could do that by closing a trove at each step. what's worse for system?  close early trove, or later?
# later removes a lower stake

