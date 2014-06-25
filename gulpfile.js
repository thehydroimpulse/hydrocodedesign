var gulp   = require('gulp');
var es6    = require('gulp-es6-module-transpiler');
var concat = require('gulp-concat');

gulp.task('default', ['compile'], function() {
  gulp.watch('src/**/*.js', ['compile']);
});

gulp.task('compile', function() {
  gulp.src('src/**/*.js')
    .pipe(es6({
      type: 'amd'
    }))
    .pipe(concat('app.js'))
    .pipe(gulp.dest('public/dist'))
});

