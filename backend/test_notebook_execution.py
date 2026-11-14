import json
import os
import sys

# Unbuffer stdout
sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

# Non-interactive matplotlib backend so plt.show() does not block
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.show = lambda *args, **kwargs: None

nb_path = os.path.join(os.path.dirname(__file__), "APF3_TD_Grupo_ML_Innovacion.ipynb")
with open(nb_path, "r", encoding="utf-8") as f:
    nb = json.load(f)

print(f"Total celdas en el notebook: {len(nb['cells'])}")
code_cells = [c for c in nb['cells'] if c['cell_type'] == 'code']
print(f"Celdas de código a ejecutar: {len(code_cells)}\n")

os.chdir(os.path.dirname(__file__))

global_scope = {
    "__file__": nb_path,
    "__name__": "__main__",
    "plt": plt
}
local_scope = {}

all_passed = True
for idx, cell in enumerate(code_cells):
    code = "".join(cell["source"])
    print(f"============================================================")
    print(f"EJECUTANDO CELDA #{idx+1} (Execution count: {cell.get('execution_count')})")
    print(f"============================================================")
    try:
        exec(code, global_scope, local_scope)
        # Sincronizar variables locales con globales para celdas subsecuentes
        global_scope.update(local_scope)
        print(f"[OK] Celda #{idx+1} ejecutada con éxito.\n")
    except Exception as e:
        print(f"[ERROR CRÍTICO] Falló en Celda #{idx+1}: {e}\n")
        import traceback
        traceback.print_exc()
        all_passed = False
        break

if all_passed:
    print("=" * 65)
    print("✓ ¡TODAS LAS CELDAS DEL NOTEBOOK EJECUTARON AL 100% SIN ERRORES!")
    print("✓ El archivo .ipynb es 100% reproducible y apto para entrega.")
    print("=" * 65)
else:
    print("Hubo fallos al ejecutar el notebook.")
