import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'jurisdiction_housing_summary.csv')
    
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    # 1. Top 10 cities by total building permits
    print("Generating Top 10 cities by building permits...")
    top_10 = df.groupby('JURIS_NAME')['total_building_permits'].sum().nlargest(10).reset_index()
    
    plt.figure(figsize=(10, 6))
    sns.barplot(data=top_10, x='total_building_permits', y='JURIS_NAME', palette='viridis')
    plt.title('Top 10 Jurisdictions by Total Building Permits')
    plt.xlabel('Total Building Permits')
    plt.ylabel('Jurisdiction')
    plt.tight_layout()
    plt.savefig(os.path.join(script_dir, 'top_10_cities_permits.png'))
    plt.close()

    # 2. Affordable vs Market Rate trends
    print("Generating Affordable vs Market Rate trends...")
    yearly_trend = df.groupby('YEAR')[['total_affordable_permits', 'total_market_rate_permits']].sum().reset_index()
    
    plt.figure(figsize=(10, 6))
    plt.plot(yearly_trend['YEAR'], yearly_trend['total_market_rate_permits'], label='Market Rate Permits', marker='o')
    plt.plot(yearly_trend['YEAR'], yearly_trend['total_affordable_permits'], label='Affordable Permits', marker='o')
    plt.title('Building Permits Trend: Affordable vs Market Rate')
    plt.xlabel('Year')
    plt.ylabel('Total Permits')
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig(os.path.join(script_dir, 'affordable_vs_market_trend.png'))
    plt.close()
    
    # 3. Total Completed Units by Year
    print("Generating Total Completed Units by Year...")
    yearly_completed = df.groupby('YEAR')['total_completed_units'].sum().reset_index()
    
    plt.figure(figsize=(10, 6))
    sns.barplot(data=yearly_completed, x='YEAR', y='total_completed_units', palette='Blues_d')
    plt.title('Total Completed Units by Year')
    plt.xlabel('Year')
    plt.ylabel('Total Completed Units')
    plt.tight_layout()
    plt.savefig(os.path.join(script_dir, 'completed_units_trend.png'))
    plt.close()

    print("\n--- INSIGHTS DATA ---")
    print("\nTop 10 Cities Permits:")
    print(top_10)
    print("\nYearly Trend:")
    print(yearly_trend)
    print("\nYearly Completed:")
    print(yearly_completed)

if __name__ == '__main__':
    main()
