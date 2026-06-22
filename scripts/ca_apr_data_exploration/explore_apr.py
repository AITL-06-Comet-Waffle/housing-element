import pandas as pd
import numpy as np
import os

def main():
    data_dir = '../ca_apr_data'
    table_a_path = os.path.join(data_dir, 'tablea.csv')
    table_a2_path = os.path.join(data_dir, 'tablea2.csv')

    print("Loading Table A (Pipeline)...")
    try:
        df_a = pd.read_csv(table_a_path, low_memory=False)
    except FileNotFoundError:
        print(f"File not found: {table_a_path}")
        return

    print("Loading Table A2 (Construction)...")
    try:
        df_a2 = pd.read_csv(table_a2_path, low_memory=False)
    except FileNotFoundError:
        print(f"File not found: {table_a2_path}")
        return

    print(f"Table A rows: {len(df_a)}, Table A2 rows: {len(df_a2)}")

    # 1. Feature Extraction: Pipeline & Approvals (Table A)
    for col in ['TOT_PROPOSED_UNITS', 'TOT_APPROVED_UNITS', 'TOT_DISAPPROVED_UNITS']:
        if col in df_a.columns:
            df_a[col] = pd.to_numeric(df_a[col], errors='coerce').fillna(0)

    pipeline_agg = df_a.groupby(['JURIS_NAME', 'YEAR']).agg(
        total_proposed_units=('TOT_PROPOSED_UNITS', 'sum'),
        total_approved_units=('TOT_APPROVED_UNITS', 'sum'),
        total_disapproved_units=('TOT_DISAPPROVED_UNITS', 'sum')
    ).reset_index()

    # 2. Feature Extraction: Construction & Affordability (Table A2)
    for col in ['NO_BUILDING_PERMITS', 'NO_OTHER_FORMS_OF_READINESS']:
        if col in df_a2.columns:
            df_a2[col] = pd.to_numeric(df_a2[col], errors='coerce').fillna(0)

    # Calculate affordable vs market rate permits
    affordable_cols = [
        'BP_ACUTELY_LOW_INCOME_DR', 'BP_ACUTELY_LOW_INCOME_NDR',
        'BP_EXTREMELY_LOW_INCOME_DR', 'BP_EXTREMELY_INCOME_NDR',
        'BP_VLOW_INCOME_DR', 'BP_VLOW_INCOME_NDR',
        'BP_LOW_INCOME_DR', 'BP_LOW_INCOME_NDR',
        'BP_MOD_INCOME_DR', 'BP_MOD_INCOME_NDR'
    ]
    
    # Ensure columns exist before processing
    existing_affordable = [c for c in affordable_cols if c in df_a2.columns]
    
    for col in existing_affordable + ['BP_ABOVE_MOD_INCOME']:
        if col in df_a2.columns:
            df_a2[col] = pd.to_numeric(df_a2[col], errors='coerce').fillna(0)

    if existing_affordable:
        df_a2['affordable_permits'] = df_a2[existing_affordable].sum(axis=1)
    else:
        df_a2['affordable_permits'] = 0

    if 'BP_ABOVE_MOD_INCOME' in df_a2.columns:
        df_a2['market_rate_permits'] = df_a2['BP_ABOVE_MOD_INCOME']
    else:
        df_a2['market_rate_permits'] = 0

    construction_agg = df_a2.groupby(['JURIS_NAME', 'YEAR']).agg(
        total_building_permits=('NO_BUILDING_PERMITS', 'sum'),
        total_completed_units=('NO_OTHER_FORMS_OF_READINESS', 'sum'),
        total_affordable_permits=('affordable_permits', 'sum'),
        total_market_rate_permits=('market_rate_permits', 'sum')
    ).reset_index()

    # 3. Merge them
    summary = pd.merge(pipeline_agg, construction_agg, on=['JURIS_NAME', 'YEAR'], how='outer').fillna(0)
    
    # Save the structured features
    summary.to_csv('jurisdiction_housing_summary.csv', index=False)
    print("Saved jurisdiction_housing_summary.csv")
    print("\nSample of aggregated metrics:")
    print(summary.head(10).to_string())

    # 4. Unstructured Data Exploration (for Pinecone)
    print("\n--- Exploring Unstructured NOTES for Pinecone ---")
    if 'NOTES' in df_a.columns:
        notes_a = df_a[['JURIS_NAME', 'YEAR', 'NOTES', 'PROJECT_NAME']].dropna(subset=['NOTES'])
        print(f"Table A contains {len(notes_a)} rows with qualitative notes.")
        if len(notes_a) > 0:
            print("Sample notes from Table A:")
            for _, row in notes_a.head(5).iterrows():
                print(f"- {row['JURIS_NAME']} ({row['YEAR']}): {row['NOTES']}")
    else:
        print("No NOTES column found in Table A.")

if __name__ == '__main__':
    main()
