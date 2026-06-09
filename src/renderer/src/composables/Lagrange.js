/**
 * @class Lagrange polynomial interpolation.
 * The computed interpolation polynomial will be referred to as L(x).
 * @example
 * const points = [{x:0, y:0}, {x:0.5, y:0.8}, {x:1, y:1}];
 * const polynomial = new Lagrange(points);
 * console.log(polynomial.evaluate(0.1));
 */
class Lagrange {
  constructor(points) {
    const ws = (this.ws = [])
    const xs = (this.xs = [])
    const ys = (this.ys = [])
    if (points && points.length) {
      this.k = points.length
      points.forEach(({ x, y }) => {
        xs.push(x)
        ys.push(y)
      })
      for (let w, j = 0; j < this.k; j++) {
        w = 1
        for (let i = 0; i < this.k; i++) if (i !== j) w *= xs[j] - xs[i]
        ws[j] = 1 / w
      }
    }
  }

  /**
   * Calculate L(x)
   */
  evaluate(x) {
    const { k, xs, ys, ws } = this
    let a = 0,
      b = 0,
      c = 0
    for (let i = 0; i < k; i++) {
      if (x === xs[i]) return ys[i]
      a = ws[i] / (x - xs[i])
      b += a * ys[i]
      c += a
    }
    return b / c
  }
}

export default Lagrange
