# Research Brief: Riser Diagram Purpose & Voltage Drop Calculation

## Date: 2026-07-22

## Refined Question
What is the proper purpose and content of an electrical riser diagram, and how should voltage drop (ΔV) be correctly calculated and displayed in such diagrams?

## Context
The user has a vertical riser diagram in their ProCal electrical design application that shows:
- Floor levels (FL 1-6)
- Voltage drop percentages (ΔV) ranging from 2.8% to 14.0%
- Floor demand (kW) and current (A)
- Apartment units with breaker size and cable size
- Color coding for normal (<3%), warning (3-5%), and danger (>5%) voltage drop

The user reports:
1. "The riser diagram gives nothing" - implying it doesn't show useful/meaningful information
2. "The delta V is not correct" - the voltage drop calculation is inaccurate

## Current Implementation Issues Identified
1. Hardcoded cable length (15m between floors) instead of actual lengths
2. Cumulative voltage drop calculation from bottom to top (incorrect)
3. Using first item's cable size for entire floor calculation
4. Not using actual cableLength field from floor items

## Scope
- What should a riser diagram show according to electrical engineering standards (IEC, NEC, BS)?
- What are the correct voltage drop calculation methods?
- What information would make this diagram actually useful for electrical engineers?

## Assumptions
- Target audience: Electrical engineers designing building distribution systems
- Standards: IEC 60364, NEC, BS 7671
- System: 3-phase 400V distribution with 230V single-phase loads

## Depth Mode: standard
