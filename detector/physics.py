"""Datasheet pump model: expected head, flow, power and current at the current speed, from assets.csv alone.

Relations (TECHNICAL_MODEL.md section 2, affinity laws built in):
    head        H(Q, r) = H_bep (h0 r^2 - (h0 - 1) (Q / Q_bep)^2)         h0 = shut-off head / BEP head
    efficiency  eta = eta_r q (2 - q),  eta_r = 1 - (1 - eta_bep) r^-0.1,  q = Q / (r Q_bep)
    shaft power P = rho g Q_bep H_bep / eta_r * r^3 * h(q) / (2 - q)
    NPSH3       NPSH3 = NPSH3_bep r^2 (0.55 + 0.45 q^2.6)
Motor: losses L = L_rated (0.35 + 0.65 lambda^2); power factor droops at part load; VFD efficiency from the DOE table.
Everything is vectorised over numpy arrays. Flow inversions use bisection on the monotone branch (q <= 1.3).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

G = 9.80665
P_ATM = 101_325.0
MOTOR_EFF = 0.95      # IE3-class assumption; the product eff * pf is checked against the nameplate current
VFD_EFF = 0.97
SUCTION_V_BEP = 2.5   # m/s suction line velocity at BEP flow (TECHNICAL_MODEL.md section 3)


def water_density(t_c, salinity_psu=0.0):
    t = np.asarray(t_c, dtype=float)
    return 999.84 + 0.0679 * t - 0.009096 * t ** 2 + 1.0e-4 * t ** 3 - 1.0e-6 * t ** 4 + 0.78 * salinity_psu


def vapour_pressure_pa(t_c):
    t = np.asarray(t_c, dtype=float)
    return 10 ** (8.07131 - 1730.63 / (233.426 + t)) * 133.322


@dataclass
class Pump:
    asset_id: str
    q_bep: float        # m3/h
    h_bep: float        # m
    h0: float           # shut-off / BEP head ratio
    eta_bep: float
    npsh_bep: float     # m
    p_rated_w: float
    i_rated: float
    v_line: float
    vfd: bool
    salinity: float
    pf_rated: float

    @classmethod
    def from_asset(cls, a: pd.Series) -> "Pump":
        vfd = str(a["control"]).startswith("VFD")
        p_rated = float(a["motor_rated_kw"]) * 1000.0
        # nameplate current fixes eff * pf; split it with the assumed motor efficiency
        eff_pf = p_rated / (np.sqrt(3) * float(a["supply_voltage_v"]) * float(a["motor_rated_current_a"]))
        return cls(asset_id=a["asset_id"], q_bep=float(a["pump_rated_flow_m3_h"]), h_bep=float(a["pump_rated_head_m"]),
                   h0=float(a["pump_shutoff_head_m"]) / float(a["pump_rated_head_m"]), eta_bep=float(a["pump_bep_efficiency"]),
                   npsh_bep=float(a["npsh3_at_bep_m"]), p_rated_w=p_rated, i_rated=float(a["motor_rated_current_a"]),
                   v_line=float(a["supply_voltage_v"]), vfd=vfd, salinity=6.0 if "Seawater" in str(a["fluid"]) else 0.0,
                   pf_rated=float(np.clip(eff_pf / MOTOR_EFF, 0.6, 0.95)))

    # ---- hydraulics (Q in m3/h, H in m) -----------------------------------------------------------------------------
    def head(self, q_m3h, r):
        q, r = np.asarray(q_m3h, float), np.asarray(r, float)
        return np.maximum(self.h_bep * (self.h0 * r ** 2 - (self.h0 - 1.0) * (q / self.q_bep) ** 2), 0.0)

    def flow_from_head(self, h_m, r):
        """Invert the curve on its falling branch. NaN where the head is above shut-off at this speed."""
        h, r = np.asarray(h_m, float), np.asarray(r, float)
        x = (self.h0 * r ** 2 - h / self.h_bep) / (self.h0 - 1.0)
        with np.errstate(invalid="ignore"):
            q = self.q_bep * np.sqrt(np.where(x >= 0, x, np.nan))
        return q

    def shaft_power_w(self, q_m3h, r, rho=1000.0):
        q, r = np.asarray(q_m3h, float) / 3600.0, np.asarray(r, float)
        r_safe = np.maximum(r, 1e-6)
        qq = np.clip(q / (r_safe * self.q_bep / 3600.0), 0.0, 1.95)
        eta_r = 1.0 - (1.0 - self.eta_bep) * np.maximum(r_safe, 0.05) ** -0.1
        p_bep = rho * G * (self.q_bep / 3600.0) * self.h_bep / eta_r
        h = self.h0 - (self.h0 - 1.0) * qq ** 2
        return p_bep * r_safe ** 3 * np.maximum(h, 0.0) / (2.0 - qq) * (r > 0)

    def motor(self, p_shaft_w):
        """Input power [W] and line current [A] from shaft power (with drive losses when a VFD exists)."""
        p = np.asarray(p_shaft_w, float)
        lam = np.clip(p / self.p_rated_w, 0.0, 2.0)
        l_rated = self.p_rated_w * (1.0 / MOTOR_EFF - 1.0)
        p_in = p + (0.35 * l_rated + 0.65 * l_rated * lam ** 2) * (p > 0)
        pf = np.clip(self.pf_rated * (1.0 - np.exp(-lam / 0.3)) / (1.0 - np.exp(-1.0 / 0.3)), 0.05, 0.95)
        i = np.where(p_in > 0, p_in / (np.sqrt(3.0) * self.v_line * pf), 0.0)
        if self.vfd:
            eff = np.interp(lam, [0.0, 0.125, 0.25, 0.5, 0.75, 1.0], [0.80, 0.88, 0.93, 0.96, 0.965, 0.97]) * (VFD_EFF / 0.97)
            p_in = p_in / eff
        return p_in, i

    def input_power_kw(self, q_m3h, r, rho=1000.0):
        return self.motor(self.shaft_power_w(q_m3h, r, rho))[0] / 1000.0

    def current_a(self, q_m3h, r, rho=1000.0):
        return self.motor(self.shaft_power_w(q_m3h, r, rho))[1]

    def _invert(self, fn, target, r, rho):
        """Bisection for Q in [0, 1.3 r Q_bep] where fn(Q, r) is increasing in Q."""
        target, r = np.asarray(target, float), np.asarray(r, float)
        lo = np.zeros_like(target)
        hi = 1.3 * np.maximum(r, 0.05) * self.q_bep * np.ones_like(target)
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            f = fn(mid, r, rho)
            lo = np.where(f < target, mid, lo)
            hi = np.where(f < target, hi, mid)
        q = 0.5 * (lo + hi)
        bad = (target <= fn(np.zeros_like(target), r, rho)) | (target >= fn(1.3 * np.maximum(r, 0.05) * self.q_bep, r, rho))
        return np.where(bad, np.nan, q)

    def flow_from_power(self, p_in_kw, r, rho=1000.0):
        return self._invert(self.input_power_kw, np.asarray(p_in_kw, float), r, rho)

    def flow_from_current(self, i_a, r, rho=1000.0):
        return self._invert(self.current_a, np.asarray(i_a, float), r, rho)

    # ---- NPSH -------------------------------------------------------------------------------------------------------
    def npsh_margin(self, ps_kpa_g, q_m3h, r, fluid_t_c, rho):
        """sigma = NPSHa / NPSH3. The gauge reads static pressure, so the velocity head is added back."""
        q, r = np.asarray(q_m3h, float), np.asarray(r, float)
        v = SUCTION_V_BEP * q / self.q_bep
        p_abs = np.asarray(ps_kpa_g, float) * 1000.0 + P_ATM
        npsha = (p_abs - vapour_pressure_pa(fluid_t_c)) / (rho * G) + v ** 2 / (2 * G)
        r_safe = np.maximum(r, 1e-6)
        qq = np.clip(q / (r_safe * self.q_bep), 0.0, 2.0)
        npsh3 = self.npsh_bep * r_safe ** 2 * (0.55 + 0.45 * qq ** 2.6)
        return npsha / np.maximum(npsh3, 1e-3), npsha, npsh3
